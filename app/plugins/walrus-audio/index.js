// Built-in Tone Zone plugin: Walrus Audio.
// Blocks inspired by Walrus Audio pedals. Names and artwork are Tone Zone originals; control layouts, colours and
// footswitch / LED arrangements follow the real units (see each block's `ref`).
//
// One custom enclosure ("walrus-etch") serves the whole family: a matte powder-coat body in a muted colour, a thin
// double frame and an engraved / woodcut-style illustration printed in metallic ink (gold, silver, copper) or a
// flat ink. Per-block art parameters: `color` (body), `ink` (gold | silver | copper | #hex), `scene` (illustration),
// `size` (n = 125B, w = wide, x = big Mako-style box, b = small).
export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, SLIDER, def, ten, db, ms, MONO, STEREO } = tz.helpers;
  const { svg, label, shade, formKit, noisePattern } = tz.gfx;

  // ------------------------------------------------------------------ helpers
  let seq = 0;
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  const rng = (seed) => { let s = seed % 2147483647 || 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const METALS = {
    gold: ['#fff3c4', '#d8b25a', '#8e6b24', '#f4dc94', '#a9842f'],
    silver: ['#ffffff', '#cdd2d9', '#7f8791', '#eceff3', '#959ca5'],
    copper: ['#ffd9bd', '#cf7c46', '#7c3e1d', '#f2b183', '#9a552c'],
    brass: ['#fbf0c8', '#c9a95a', '#6f5a28', '#e8d495', '#8f7638'],
  };
  const metalStops = (ink) => METALS[ink] || [shade(ink, 0.25), ink, shade(ink, -0.2), shade(ink, 0.12), shade(ink, -0.08)];
  const inkSolid = (ink) => (METALS[ink] ? METALS[ink][1] : ink);
  const tapRate = (msv) => Math.max(0, Math.min(1, Math.log(1000 / msv / 0.4) / Math.log(35)));

  const SIZES = { b: [104, 200], n: [124, 238], w: [172, 232], x: [208, 258] };
  const KR = { b: 10, n: 11, w: 12, x: 12.5 };

  // auto layout: rows of knobs (labels above, selectors print their positions), a toggle row, art zone, feet
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

  // ------------------------------------------------------------------ engraved scenes (drawn in a 100 x 60 box)
  const star4 = (x, y, r) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
  const rays = (A, cx, cy, r0, r1, n, a0 = 0, a1 = Math.PI * 2, w = 0.6) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
      d += `M${(cx + Math.cos(a) * r0).toFixed(2)} ${(cy + Math.sin(a) * r0).toFixed(2)}L${(cx + Math.cos(a) * r1).toFixed(2)} ${(cy + Math.sin(a) * r1).toFixed(2)}`;
    }
    A.S(d, w);
  };
  const scallops = (A, y, amp, n, w = 0.8, x0 = 0, x1 = 100) => {
    const st = (x1 - x0) / n;
    let d = `M${x0} ${y}`;
    for (let i = 0; i < n; i++) d += `q${st / 2} ${-amp} ${st} 0`;
    A.S(d, w);
  };
  const stars = (A, pts) => pts.forEach(([x, y, r]) => A.F(star4(x, y, r)));
  const SCENES = {
    moon(A) {
      rays(A, 50, 30, 27, 31, 36, 0, Math.PI * 2, 0.45);
      A.circle(50, 30, 25, 0.4);
      A.F('M50 8 A22 22 0 1 0 50 52 A18 22 0 1 1 50 8Z');
      A.H('M50 8 A22 22 0 0 0 36 47 A18 20 0 0 1 50 8Z');
      A.S('M41 26 q3 3 6 0', 0.7);
      A.S('M38 36 q2 2 5 1', 0.6);
      stars(A, [[70, 14, 3], [78, 30, 2.2], [66, 44, 2.6], [22, 12, 1.8], [16, 42, 2.2], [84, 48, 1.6]]);
    },
    willow(A) {
      A.circle(74, 16, 8, 0.7);
      A.H('M66 16a8 8 0 0 0 16 0a8 8 0 0 0 -16 0Z');
      A.F('M46 60 C47 48 46 36 44 26 L48 24 C50 36 52 48 54 60Z');
      A.S('M45 28 C34 18 20 16 8 22 M47 26 C58 14 72 22 86 30 M46 30 C40 24 30 26 24 32', 1);
      for (let i = 0; i < 18; i++) {
        const x = 8 + i * 4.6, top = 20 + Math.abs(i - 9) * 0.9;
        A.S(`M${x} ${top} q${i % 2 ? 1.5 : -1.5} 14 ${i % 3 - 1} ${26 - Math.abs(i - 9) * 0.8}`, 0.5);
      }
      A.S('M0 58 H100', 0.8);
      A.H('M0 58 Q30 52 60 56 T100 54 V60 H0Z');
    },
    whale(A) {
      rays(A, 50, -20, 30, 70, 14, Math.PI * 0.3, Math.PI * 0.7, 0.4);
      A.H('M12 34 C18 20 50 16 68 24 C76 27 82 30 86 26 L95 17 L93 29 L98 39 L87 33 C79 40 65 44 49 44 C31 44 17 42 12 34Z');
      A.F('M14 36 C24 40 40 43 56 42 C42 46 22 45 14 36Z');
      A.S('M22 37 Q40 41 58 40 M24 39.5 Q40 43 54 42', 0.5);
      A.F('M24 30.5a1.4 1.4 0 1 0 0.1 0Z');
      A.S('M36 44 Q40 52 46 50', 0.9);
      [[30, 12, 1.6], [34, 6, 1.1], [28, 2, 0.8], [70, 10, 1.2]].forEach(([x, y, r]) => A.circle(x, y, r, 0.5));
      scallops(A, 56, 3, 10, 0.7);
    },
    mako(A) {
      A.circle(50, 30, 29, 0.5);
      A.circle(50, 30, 26.5, 0.3);
      A.H('M5 32 C20 24 40 20 57 22 L65 9 L69 23 C79 25 87 28 91 30 L98 21 L96 32 L98 43 L90 34 C80 38 66 40 54 40 L50 47 L46 40 C30 40 14 38 5 32Z');
      A.F('M5 32 C20 24 40 20 57 22 C40 24 26 28 16 33Z');
      A.F('M8 33 C20 37 40 38 60 37 C46 41 22 40 8 33Z');
      A.S('M30 27 q-2 4 0 8 M33.5 26.5 q-2 4 0 8 M37 26 q-2 4 0 8', 0.7);
      A.F('M19 29.6a1.3 1.3 0 1 0 0.1 0Z');
      A.S('M6 33 L12 33.4', 0.6);
    },
    eye(A) {
      rays(A, 50, 36, 32, 40, 30, Math.PI, Math.PI * 2, 0.5);
      A.S('M50 4 L86 56 H14Z', 1.1);
      A.H('M50 10 L80 53 H20Z');
      A.F('M28 38 Q50 20 72 38 Q50 56 28 38Z');
      A.bgFill('M31 38 Q50 24 69 38 Q50 52 31 38Z');
      A.circle(50, 38, 8, 0.8);
      A.H('M42 38a8 8 0 1 0 16 0a8 8 0 1 0 -16 0Z');
      A.F('M47 38a3 3 0 1 0 6 0a3 3 0 1 0 -6 0Z');
    },
    mountains(A) {
      A.circle(50, 22, 9, 0.8);
      rays(A, 50, 22, 11, 15.5, 18, 0, Math.PI * 2, 0.5);
      A.H('M0 52 L18 30 L30 40 L50 16 L68 37 L80 27 L100 48 V60 H0Z');
      A.S('M0 52 L18 30 L30 40 L50 16 L68 37 L80 27 L100 48', 0.8);
      A.F('M0 60 L22 38 L38 54 L56 34 L78 58 L90 46 L100 55 V60Z');
      A.bgFill('M22 38 L27 47 L24 45 L21 48 L18 43Z M56 34 L62 44 L58 42 L55 46 L51 41Z');
      A.H('M22 38 L38 54 L30 60 Z M56 34 L78 58 L66 60Z');
    },
    obelisk(A) {
      rays(A, 50, 14, 6, 44, 22, Math.PI * 1.02, Math.PI * 1.98, 0.45);
      A.H('M0 50 Q20 40 36 46 T70 44 T100 48 V60 H0Z');
      A.F('M44.5 52 L46.5 14 L50 7 L53.5 14 L55.5 52Z');
      A.H('M50 7 L53.5 14 L55.5 52 L50 52Z');
      A.bgFill('M48 20h4v1.2h-4z M48 26h4v1.2h-4z M48 32h4v1.2h-4z');
      A.F('M38 52 H62 V55 H38Z M34 55 H66 V58 H34Z');
      A.S('M0 58 H100', 0.8);
    },
    lily(A) {
      A.S('M50 28 C50 40 46 50 48 60', 1);
      A.H('M48 50 C40 46 30 48 24 56 C34 56 42 54 48 50Z M49 44 C58 38 68 40 74 46 C66 48 56 48 49 44Z');
      [-72, -36, 0, 36, 72].forEach((a, i) => {
        const p = 'M50 28 C43 18 45 7 50 2 C55 7 57 18 50 28Z';
        A.g2(`rotate(${a} 50 28)`, (B) => (i % 2 ? B.H(p) : B.F(p)));
      });
      A.circle(50, 28, 3.4, 0.8);
      A.F('M47.5 28a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0Z');
    },
    geo(A) {
      [6, 12, 18, 24].forEach((r) => A.circle(50, 30, r, 0.55));
      const hexP = (r, rot) => [...Array(6)].map((_, i) => { const a = rot + (Math.PI / 3) * i; return `${(50 + Math.cos(a) * r).toFixed(2)} ${(30 + Math.sin(a) * r).toFixed(2)}`; });
      A.S('M' + hexP(24, -Math.PI / 2).join('L') + 'Z', 0.8);
      const t = hexP(24, -Math.PI / 2);
      A.S(`M${t[0]}L${t[2]}L${t[4]}Z M${t[1]}L${t[3]}L${t[5]}Z`, 0.7);
      A.H('M' + hexP(12, -Math.PI / 2).join('L') + 'Z');
      t.forEach((p) => { const [x, y] = p.split(' ').map(Number); A.F(`M${x - 1.6} ${y}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0Z`); });
      rays(A, 50, 30, 27, 30, 48, 0, Math.PI * 2, 0.4);
      stars(A, [[12, 12, 2], [88, 48, 2], [86, 12, 1.4], [14, 48, 1.4]]);
    },
    temple(A) {
      rays(A, 50, 26, 26, 36, 20, Math.PI * 1.05, Math.PI * 1.95, 0.45);
      A.H('M30 46 V26 Q50 0 70 26 V46Z');
      A.S('M30 26 Q50 0 70 26', 1);
      A.F('M49 6 L50 0 L51 6 Z M48.5 6 h3 v2 h-3z');
      A.F('M14 46 V30 Q20 20 26 30 V46Z M74 46 V30 Q80 20 86 30 V46Z');
      A.bgFill('M44 46 V34 Q50 26 56 34 V46Z M18 46 V36 Q20 32 22 36 V46Z M78 46 V36 Q80 32 82 36 V46Z');
      A.F('M8 46 H92 V49 H8Z');
      A.S('M4 52 H96 M0 55.5 H100 M0 59 H100', 0.7);
    },
    ship(A) {
      A.circle(84, 12, 6, 0.6);
      A.H('M16 40 L84 40 L77 50 H25Z');
      A.S('M16 40 L84 40 L77 50 H25Z', 0.9);
      A.S('M32 40 V8 M52 40 V4 M70 40 V12', 0.9);
      A.F('M33 10 Q42 18 33 26Z M33 28 Q43 33 33 38Z M53 6 Q65 15 53 24Z M53 26 Q66 31 53 37Z M71 14 Q79 20 71 27Z');
      A.H('M33 10 Q38 18 33 26Z M53 6 Q60 15 53 24Z');
      A.S('M16 40 L8 30 M84 40 L90 32', 0.6);
      A.F('M52 4 l7 2 l-7 2z');
      scallops(A, 53, 3, 12, 0.8);
      scallops(A, 58, 2.5, 14, 0.6);
      A.S('M14 14 q3 -2 6 0 q3 -2 6 0 M20 22 q2 -1.5 4 0 q2 -1.5 4 0', 0.6);
    },
    waves(A) {
      A.circle(80, 14, 7, 0.7);
      A.H('M73 14a7 7 0 0 0 14 0a7 7 0 0 0 -14 0Z');
      A.H('M6 44 C6 18 42 8 54 22 C44 14 26 18 28 32 C30 40 40 41 44 34 C40 46 20 50 6 44Z');
      A.S('M6 44 C6 18 42 8 54 22 C44 14 26 18 28 32 C30 40 40 41 44 34', 1.2);
      A.S('M12 40 C12 24 34 14 46 20 M18 38 C18 28 30 22 38 24', 0.6);
      [40, 47, 54].forEach((y, j) => scallops(A, y + 2, 4 - j * 0.6, 7 + j, 0.8, j ? 0 : 44, 100));
      A.F('M54 22 q4 -4 8 -2 q-4 0 -4 4z');
    },
    horse(A) {
      rays(A, 48, 32, 28, 34, 40, 0, Math.PI * 2, 0.45);
      A.circle(48, 32, 26, 0.6);
      A.H('M36 58 L38 46 C32 42 26 36 27 30 L21 32 L19 27 L30 17 L32 8 L37 14 C48 10 61 16 65 28 C69 39 65 49 62 58Z');
      A.S('M36 58 L38 46 C32 42 26 36 27 30 L21 32 L19 27 L30 17 L32 8 L37 14 C48 10 61 16 65 28 C69 39 65 49 62 58', 1.1);
      A.F('M37 14 C48 10 61 16 65 28 C69 39 65 49 62 58 L58 58 C61 46 62 36 56 26 C52 20 44 16 37 14Z');
      A.F('M31 22.5a1.4 1.4 0 1 0 0.1 0Z');
      A.S('M21.5 29 q2 -1 3 1', 0.7);
    },
    planet(A) {
      stars(A, [[12, 10, 2.2], [86, 8, 1.6], [90, 46, 2.4], [8, 50, 1.4], [70, 54, 1.2], [24, 30, 1.2]]);
      A.S('M14 40 C30 50 70 30 88 18', 0.4, '1.2 1.6');
      A.F('M36 30a14 14 0 1 0 28 0a14 14 0 1 0 -28 0Z');
      A.H('M44 18 A14 14 0 0 0 50 44 A14 14 0 0 1 44 18Z');
      A.bgFill('M40 22 Q50 26 60 22 L60.8 23.6 Q50 28 39.3 23.6Z');
      A.g2('rotate(-14 50 30)', (B) => { B.S('M22 30 A28 7 0 0 0 78 30', 1.2); B.S('M24 30 A26 5.5 0 0 0 76 30', 0.5); });
    },
    bird(A) {
      rays(A, 50, 34, 8, 30, 26, Math.PI, Math.PI * 2, 0.4);
      A.H('M18 36 C30 30 42 30 50 33 C56 20 68 10 84 6 C75 16 68 27 61 35 C71 35 80 39 86 45 C74 43 63 41 54 40 C46 46 33 46 25 42 L12 46 L19 39Z');
      A.S('M18 36 C30 30 42 30 50 33 C56 20 68 10 84 6 C75 16 68 27 61 35 C71 35 80 39 86 45 C74 43 63 41 54 40 C46 46 33 46 25 42 L12 46 L19 39Z', 0.9);
      A.F('M50 33 C56 20 68 10 84 6 C70 14 62 24 56 34Z');
      A.S('M24 41 C30 50 36 54 44 52 M30 46 q-3 3 -2 6 M36 49 q-1 3 1 5 M40 51 q2 1 3 4', 0.6);
      A.F('M22.5 36.2a1 1 0 1 0 0.1 0Z');
    },
    anchor(A) {
      A.circle(50, 9, 4, 1.4);
      A.F('M48.6 13 H51.4 V52 H48.6Z M36 18 H64 V21 H36Z');
      A.S('M28 38 Q34 58 50 54 Q66 58 72 38', 2.2);
      A.F('M25 42 L28 34 L33 41Z M75 42 L72 34 L67 41Z');
      A.S('M54 9 C70 14 60 26 70 32 C78 36 74 46 64 44', 0.8);
      [[22, 14, 1.6], [18, 8, 1.1], [80, 18, 1.4], [84, 10, 1]].forEach(([x, y, r]) => A.circle(x, y, r, 0.5));
      scallops(A, 59, 2, 12, 0.6);
    },
    desert(A) {
      A.F('M30 40 A20 20 0 0 1 70 40Z');
      rays(A, 50, 40, 23, 36, 22, Math.PI, Math.PI * 2, 0.6);
      A.H('M0 40 L12 32 L22 36 L34 30 L44 38 L56 33 L70 37 L84 29 L100 38 V40 H0Z');
      A.S('M0 40 H100', 0.9);
      A.S('M8 44 L22 46 L30 43 L44 47 L58 44 L70 48 L86 45 L98 47 M14 46 L10 52 L22 56 L28 50 M30 43 L34 52 L46 55 L44 47 M58 44 L56 52 L68 57 L70 48 M86 45 L84 53 L96 58 M22 56 L18 60 M46 55 L50 60 M68 57 L64 60', 0.55);
    },
    swords(A) {
      A.circle(50, 32, 18, 0.9);
      A.H('M32 32a18 18 0 1 0 36 0a18 18 0 1 0 -36 0Z');
      ['rotate(-38 50 32)', 'rotate(38 50 32)'].forEach((t) => A.g2(t, (B) => {
        B.F('M48.6 2 L50 -2 L51.4 2 V40 H48.6Z');
        B.bgFill('M49.7 3 H50.3 V38 H49.7Z');
        B.F('M42 40 H58 V42.6 H42Z M48.8 42.6 H51.2 V52 H48.8Z');
        B.F('M48 54a2 2 0 1 0 4 0a2 2 0 1 0 -4 0Z');
      }));
    },
    clouds(A) {
      A.circle(74, 18, 8, 0.8);
      rays(A, 74, 18, 10, 13, 16, 0, Math.PI * 2, 0.5);
      const cloud = (x, y, s) => `M${x} ${y} c${-7 * s} 0 ${-7 * s} ${-9 * s} 0 ${-9 * s} c0 ${-7 * s} ${11 * s} ${-9 * s} ${13 * s} ${-2 * s} c${4 * s} ${-6 * s} ${14 * s} ${-4 * s} ${14 * s} ${4 * s} c${6 * s} 0 ${7 * s} ${7 * s} ${1 * s} ${7 * s}Z`;
      [[16, 50, 1.2], [50, 36, 1], [62, 56, 0.9]].forEach(([x, y, s]) => { A.H(cloud(x, y, s)); A.S(cloud(x, y, s), 0.8); A.S(`M${x + 6 * s} ${y - 3 * s} a${3 * s} ${3 * s} 0 1 1 ${4 * s} ${-3 * s}`, 0.6); });
      A.S('M4 24 C14 20 18 28 28 24 M36 14 C44 10 48 16 56 12', 0.6);
    },
    book(A) {
      stars(A, [[50, 8, 3], [36, 14, 1.8], [64, 13, 2], [28, 6, 1.2], [72, 4, 1.3]]);
      A.S('M42 20 Q46 14 50 12 Q54 14 58 20', 0.5, '1 1.4');
      A.H('M50 50 C40 44 24 44 12 48 V22 C24 18 40 18 50 24Z M50 50 C60 44 76 44 88 48 V22 C76 18 60 18 50 24Z');
      A.S('M50 50 C40 44 24 44 12 48 V22 C24 18 40 18 50 24 C60 18 76 18 88 22 V48 C76 44 60 44 50 50 V24', 1);
      A.bgFill('M18 27 C26 25 36 25 44 28 V30 C36 27 26 27 18 29Z M56 28 C64 25 74 25 82 27 V29 C74 27 64 27 56 30Z');
      A.S('M18 33 C26 31 36 31 44 34 M18 38 C26 36 36 36 44 39 M56 34 C64 31 74 31 82 33 M56 39 C64 36 74 36 82 38', 0.6);
      A.F('M10 50 C24 46 40 46 50 53 C60 46 76 46 90 50 V52 C76 49 60 49 50 56 C40 49 24 49 10 52Z');
    },
    moth(A) {
      A.H('M50 28 C40 8 18 4 8 13 C12 27 30 33 50 32Z M50 28 C60 8 82 4 92 13 C88 27 70 33 50 32Z');
      A.S('M50 28 C40 8 18 4 8 13 C12 27 30 33 50 32 C70 33 88 27 92 13 C82 4 60 8 50 28', 0.9);
      A.F('M50 32 C38 34 26 42 28 53 C38 53 46 43 50 34Z M50 32 C62 34 74 42 72 53 C62 53 54 43 50 34Z');
      A.bgFill('M24 18a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z M66 18a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z');
      A.F('M26.8 18a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0Z M68.8 18a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0Z');
      A.F('M48 22 C48 18 52 18 52 22 L51.4 48 Q50 52 48.6 48Z');
      A.S('M49 19 C46 12 40 8 36 8 M51 19 C54 12 60 8 64 8', 0.7);
      stars(A, [[10, 44, 1.6], [90, 44, 1.6], [50, 4, 1.4]]);
    },
  };

  // ------------------------------------------------------------------ the enclosure
  tz.addForm('walrus-etch', (ctx, def) => {
    const g = ctx.g;
    const sz = def.size || 'n';
    const [W, H] = SIZES[sz];
    const id = 'wa' + ++seq;
    const bg = def.color, stops = metalStops(def.ink || 'gold');
    const txt = def.text || inkSolid(def.ink || 'gold');
    const defs = svg('defs', {}, g);
    const grad = (gid, x2, y2) => {
      const lg = svg('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2, y2 }, defs);
      stops.forEach((c, i) => svg('stop', { offset: i / (stops.length - 1), 'stop-color': c }, lg));
      return `url(#${gid})`;
    };
    const metalFace = grad(id + 'mf', W, H * 0.6);
    const metalArt = grad(id + 'ma', 100, 60);
    const hp = svg('pattern', { id: id + 'h', width: 2.1, height: 2.1, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(38)' }, defs);
    svg('rect', { width: 0.62, height: 2.1, fill: stops[1] }, hp);
    noisePattern(defs, id + 'n', 60, 64, [0, 0, 0], 0, 0.22, 0);
    // body: matte powder coat with a fine speckle
    formKit.body(g, W, H, bg, { rx: 7 });
    svg('rect', { x: 0, y: 0, width: W, height: H, rx: 7, fill: `url(#${id}n)`, opacity: 0.5 }, g);
    // printed double frame with corner diamonds
    svg('rect', { x: 5, y: 5, width: W - 10, height: H - 10, rx: 3.5, fill: 'none', stroke: metalFace, 'stroke-width': 0.9, opacity: 0.85 }, g);
    svg('rect', { x: 7.5, y: 7.5, width: W - 15, height: H - 15, rx: 2.5, fill: 'none', stroke: metalFace, 'stroke-width': 0.35, opacity: 0.7 }, g);
    for (const [x, y] of [[5, 5], [W - 5, 5], [5, H - 5], [W - 5, H - 5]]) svg('path', { d: `M${x} ${y - 3}L${x + 3} ${y}L${x} ${y + 3}L${x - 3} ${y}Z`, fill: metalFace }, g);
    const L = layout(def, W, H, sz);
    // art + name
    const tagH = def.tagline ? 8 : 2;
    const nameSize = Math.max(10, Math.min(def.logoSize || (sz === 'x' ? 17 : sz === 'w' ? 15 : sz === 'b' ? 11.5 : 13), L.y1 - L.y0 - tagH - 2));
    const nameY = L.y1 - tagH - nameSize * 0.5;
    const artBottom = nameY - nameSize * 0.5 - 5;
    const big = artBottom - L.y0 >= 30;
    const box = big ? { x: 10, y: L.y0 + 2, w: W - 20, h: artBottom - L.y0 - 2 } : { x: 10, y: 12, w: W - 20, h: artBottom - 12 };
    const clip = svg('clipPath', { id: id + 'c' }, defs);
    svg('rect', { x: box.x, y: box.y, width: box.w, height: box.h }, clip);
    const outer = svg('g', { 'clip-path': `url(#${id}c)`, opacity: big ? 1 : def.ghost ?? 0.36 }, g);
    const s = Math.min(box.w / 100, box.h / 60);
    const art = svg('g', { transform: `translate(${(box.x + (box.w - 100 * s) / 2).toFixed(2)},${(box.y + (box.h - 60 * s) * (big ? 0.5 : 0.92)).toFixed(2)}) scale(${s.toFixed(3)})` }, outer);
    const mkA = (parent) => {
      const A = {
        S: (d, w = 0.8, dash) => svg('path', { d, fill: 'none', stroke: metalArt, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': dash }, parent),
        F: (d) => svg('path', { d, fill: metalArt }, parent),
        H: (d) => svg('path', { d, fill: `url(#${id}h)` }, parent),
        bgFill: (d) => svg('path', { d, fill: bg }, parent),
        circle: (cx, cy, r, w = 0.8) => svg('circle', { cx, cy, r, fill: 'none', stroke: metalArt, 'stroke-width': w }, parent),
        g2: (transform, fn) => fn(mkA(svg('g', { transform }, parent))),
      };
      return A;
    };
    (SCENES[def.scene] || SCENES.mountains)(mkA(art));
    // model name in the engraved-plate style
    label(g, W / 2, nameY, def.logo || def.name, { size: nameSize, fill: metalFace, font: "'Oswald', sans-serif", weight: 500, ls: sz === 'b' ? 1.2 : 2.4 });
    if (def.tagline) label(g, W / 2, nameY + nameSize * 0.5 + 5, def.tagline, { size: 4.6, fill: txt, weight: 700, ls: 1.6, opacity: 0.85 });
    const badge = formKit.tzBadge(g, W / 2, L.nFeet >= 2 ? L.footY + 1 : H - 10, txt, 4.2);
    void badge;
    const theme = { text: txt, knob: def.knob || 'strymon', labelSize: sz === 'b' ? 5.6 : 6, labelFont: "'Barlow Condensed', sans-serif", labelLs: 0.6 };
    formKit.placeControls(ctx, def.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(def, W, { flip: ctx.flip }) };
  });


  // ------------------------------------------------------------------ Fundamental series: small matte black box,
  // three horizontal sliders with a coloured cap, a 3-way mode switch and a thin accent line.
  const fundOwned = new WeakSet();
  tz.addForm('walrus-fund', (ctx, def) => {
    const g = ctx.g, W = 104, H = 204, acc = def.accent || '#e8b04a';
    const id = 'waf' + ++seq;
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [255, 255, 255], 0, 0.09, 0);
    formKit.body(g, W, H, '#1b1b1c', { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    label(g, W / 2, 20, def.logo || def.name, { size: Math.min(13, (W - 20) / (String(def.logo || def.name).length * 0.62)), fill: '#f2f0ea', font: "'Oswald', sans-serif", weight: 500, ls: 2.2 });
    svg('rect', { x: W / 2 - 16, y: 28, width: 32, height: 1.4, fill: acc }, g);
    if (def.tagline) label(g, W / 2, 36, def.tagline, { size: 4.6, fill: acc, weight: 700, ls: 1.4 });
    def.controls.forEach((c) => { if (c.x === undefined) fundOwned.add(c); });
    const own = def.controls.filter((c) => fundOwned.has(c));
    own.filter((c) => c.t === 'slider').forEach((c, i) => {
      Object.assign(c, { x: 67, y: 54 + i * 22, h: 50, orient: 'h', capColor: acc, label: '', marks: false });
      label(g, 10, c.y, c.title, { size: 5.2, fill: '#d8d6d0', weight: 700, ls: 0.4, anchor: 'start' });
    });
    own.filter((c) => c.t === 'toggle').forEach((c) => Object.assign(c, { x: W / 2 - 12, y: 130, orient: 'v' }));
    own.filter((c) => c.t === 'foot').forEach((c) => Object.assign(c, { x: W / 2, y: H - 28, r: 12, style: 'stomp' }));
    own.filter((c) => c.t === 'led').forEach((c) => Object.assign(c, { x: W / 2, y: 154, r: 2.6 }));
    const tg = def.controls.find((c) => c.t === 'toggle');
    if (tg) label(g, W / 2, 130 - 22, tg.label, { size: 5.2, fill: '#d8d6d0', weight: 700, ls: 1 });
    formKit.tzBadge(g, W / 2, H - 8, '#bdbab2', 3.6);
    const theme = { text: '#d8d6d0', knob: 'strymon', labelSize: 5.6, toggleTitles: false };
    formKit.placeControls(ctx, def.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(def, W, { flip: ctx.flip }) };
  });
  const FU = (o) => def(Object.assign({ form: 'walrus-fund', brand: 'Walrus Audio', cost: 0.6 }, o, { controls: [...o.controls, FOOT(), LED({ color: '#ff3a24' })] }));
  const sl = (p, title, o = {}) => SLIDER(p, '', Object.assign({ title }, o));

  // ------------------------------------------------------------------ block builder
  const WA = (o) => def(Object.assign({ form: 'walrus-etch', brand: 'Walrus Audio', cost: 0.8 }, o, {
    controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff3a24' })])],
  }));
  const pctD = (v) => Math.round(v * 100) + '%';
  const bypassFoot = () => FOOT({ action: 'bypass', label: 'BYPASS' });

  tz.addDefs([
    // ---------------- modulation
    WA({
      id: 'wa.julia', name: 'Jolie Chorus/Vibrato', ref: 'Walrus Audio Julia V2', logo: 'JOLIE', tagline: 'ANALOG CHORUS / VIBRATO', cat: 'Modulation',
      color: '#a8cbbd', ink: '#8a4526', text: '#3f2a1c', scene: 'moon', knob: 'cream', stereo: 'both',
      algo: 'chorus', opts: { baseMs: 7, depthMs: 4 }, rows: [2, 2],
      controls: [
        K('rate', 'RATE', { def: 0.35 }), K('depth', 'DEPTH', { def: 0.5 }),
        K('delay', 'LAG', { def: 0.45 }), K('dpv', 'D-P-V', { def: 0.5, virtual: true, display: pctD }),
        TOG('wave', 'WAVE', ['tri', 'sine', 'rand'], { values: [0, 1, 0.5], def: 1 }),
      ],
      derive: (p) => ({ mix: p.dpv ?? 0.5, mode: (p.dpv ?? 0.5) > 0.92 ? 1 : 0 }),
      desc: 'D-P-V sweeps dry → chorus (noon) → pure vibrato (fully clockwise). LAG sets the centre delay time.',
    }),
    WA({
      id: 'wa.lillian', name: 'Lily Phaser', ref: 'Walrus Audio Lillian', logo: 'LILY', tagline: 'MULTI-STAGE ANALOG PHASER', cat: 'Modulation',
      color: '#d9b9b0', ink: '#5a1f2a', scene: 'lily', stereo: 'both',
      algo: 'phaser', opts: { stages: 4 }, rows: [2, 2],
      controls: [
        K('rate', 'RATE', { def: 0.35 }), K('depth', 'WIDTH', { def: 0.8 }),
        K('feedback', 'FEEDBACK', { def: 0.4 }), K('mix', 'D-P-V', { def: 0.5 }),
        TOG('stages', 'STAGES', ['4', '6'], { values: [4, 6] }), TOG('center', 'VOICE', ['warm', 'brt'], { values: [0.38, 0.62] }),
      ],
    }),
    WA({
      id: 'wa.monument', name: 'Obelisk Harmonic Tremolo', ref: 'Walrus Audio Monument V2', logo: 'OBELISK', tagline: 'HARMONIC TAP TREMOLO', cat: 'Modulation',
      color: '#5d6f65', ink: 'gold', scene: 'obelisk', size: 'w', stereo: 'both', noStd: true,
      algo: 'tremolo', rows: [3],
      controls: [
        K('rk', 'RATE', { def: 0.45, virtual: true }), K('depth', 'DEPTH', { def: 0.65 }), K('level', 'VOLUME', { def: 0.5 }),
        SEL('shape', 'SHAPE', ['SIN', 'SQR', 'TRI', 'RMP', 'LFO'], { def: 0, virtual: true, togRow: true }),
        TOG('mode', 'MODE', ['harm', 'std'], { values: [1, 0] }), TOG('div', 'DIV', ['1/4', '1/8', 'trip'], { virtual: true }),
        FOOT({ action: 'tap', label: 'TAP', tapTarget: 'tapms' }), bypassFoot(),
        LED({ bind: 'rate:on:rk', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      derive: (p) => {
        let rate = p.rk ?? 0.45;
        if (p.tapms) {
          const hz = (1000 / p.tapms) * [1, 2, 3][p.div ?? 0];
          rate = Math.max(0, Math.min(1, tapRate(1000 / hz) + ((p.rk ?? 0.5) - 0.5) * 0.25));
        }
        return { rate, wave: [0.25, 1, 0, 0.6, 0.45][p.shape ?? 0] };
      },
      desc: 'Tap the TAP switch to set the tempo (DIV subdivides it); after tapping, RATE trims around the tapped speed.',
    }),
    WA({
      id: 'wa.silt', name: 'Sediment Harmonic Tremolo', ref: 'Walrus Audio Silt', logo: 'SEDIMENT', tagline: 'HARMONIC TREMOLO', cat: 'Modulation',
      color: '#7c6a56', ink: '#efe4c8', scene: 'waves', stereo: 'both',
      algo: 'tremolo', fixed: { mode: 1 },
      controls: [K('rate', 'RATE', { def: 0.45 }), K('depth', 'DEPTH', { def: 0.6 }), K('level', 'VOLUME', { def: 0.5 }), TOG('wave', 'SHAPE', ['tri', 'sine', 'sqr'], { values: [0, 0.3, 1], def: 1 })],
    }),
    WA({
      id: 'wa.qi', name: 'Chi Etherealizer', ref: 'Walrus Audio Qi Etherealizer', logo: 'CHI', tagline: 'ETHEREALIZER', cat: 'Modulation',
      color: '#e2dbc9', ink: '#24585a', scene: 'clouds', size: 'w', stereo: 'both', cost: 1.4, noStd: true,
      algo: 'chain', opts: { chain: [{ prefix: 'c', algo: 'chorus' }, { prefix: 'f', algo: 'wah', opts: { mode: 1, fLo: 300, fHi: 3200, q: 3 } }, { prefix: 's', algo: 'slicer', on: false }] },
      controls: [
        K('c.rate', 'RATE', { def: 0.35 }), K('c.depth', 'DEPTH', { def: 0.5 }), K('c.mix', 'MIX', { def: 0.5 }),
        K('f.range', 'FILTER', { def: 0.5 }), K('f.q', 'RES', { def: 0.4 }), K('s.time', 'STUTTER', { min: 40, max: 600, def: 160, display: ms, curve: 'log' }),
        TOG('fmode', 'FILTER', ['lfo', 'env', 'off'], { def: 0 }),
        FOOT({ action: 'param', p: 's.on', toggle: true, label: 'STUTTER' }), bypassFoot(),
        LED({ bind: 'param:s.on', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      derive: (p) => ({ 'f.mode': [1, 2, 1][p.fmode ?? 0], 'f.on': p.fmode === 2 ? 0 : 1, 'f.rate': (p['c.rate'] ?? 0.35) * 0.8, 's.depth': 0.85, 's.pattern': 1 }),
    }),
    // ---------------- reverb
    WA({
      id: 'wa.slo', name: 'Slumber Reverb', ref: 'Walrus Audio Slö', logo: 'SLUMBER', tagline: 'MULTI TEXTURE REVERB', cat: 'Reverb',
      color: '#c3bfcd', ink: '#22202a', scene: 'willow', size: 'w', stereo: 'both', cost: 1.5, noStd: true,
      algo: 'reverb',
      controls: [
        K('decay', 'DECAY', { def: 0.6 }), K('tone', 'FILTER', { def: 0.55 }), K('mix', 'MIX', { def: 0.4 }),
        K('x', 'X', { def: 0.5, virtual: true }), K('depth', 'DEPTH', { def: 0.4, virtual: true }), K('mrate', 'RATE', { def: 0.4, virtual: true }),
        TOG('slmode', 'MODE', ['dark', 'rise', 'dream']),
        FOOT({ action: 'param', p: 'sus', toggle: true, label: 'SUSTAIN' }), bypassFoot(),
        LED({ bind: 'param:sus', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      derive: (p) => {
        const m = p.slmode ?? 0, x = p.x ?? 0.5;
        return {
          mode: [6, 9, 4][m], mod: (p.depth ?? 0.4) * (0.4 + 0.6 * (p.mrate ?? 0.4)), size: 0.85,
          highdamp: m === 0 ? 0.4 + 0.5 * x : 0.45, predelay: m === 1 ? 10 + 300 * x : 25, shimmer: m === 2 ? x : 0,
          decay: p.sus ? 0.99 : p.decay ?? 0.6,
        };
      },
      desc: 'DARK: darker, octave-down-ish modulated tail (X = darkness). RISE: auto-swelling reverb (X = rise time). DREAM: shimmer tail (X = shimmer). SUSTAIN latches an endless decay.',
    }),
    WA({
      id: 'wa.fathom', name: 'Abyss Reverb', ref: 'Walrus Audio Fathom', logo: 'ABYSS', tagline: 'MULTI-FUNCTION REVERB', cat: 'Reverb',
      color: '#22334b', ink: 'silver', scene: 'whale', size: 'w', stereo: 'both', cost: 1.5, noStd: true,
      algo: 'reverb',
      controls: [
        K('decay', 'DECAY', { def: 0.55 }), K('predelay', 'PRE-DELAY', { min: 0, max: 300, def: 30, display: ms }), K('mix', 'MIX', { def: 0.35 }),
        K('tone', 'FILTER', { def: 0.55 }), K('x', 'X', { def: 0.3, virtual: true }), SEL('prog', 'PROGRAM', ['HALL', 'PLATE', 'LOFI', 'REFL'], { def: 0, virtual: true }),
        FOOT({ action: 'param', p: 'sus', toggle: true, label: 'SUSTAIN' }), bypassFoot(),
        LED({ bind: 'param:sus', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      derive: (p) => {
        const pr = p.prog ?? 0, x = p.x ?? 0.3;
        return { mode: [1, 2, 6, 8][pr], mod: pr === 2 ? 0.5 + 0.5 * x : x * 0.8, tone: pr === 2 ? (p.tone ?? 0.55) * 0.55 : p.tone ?? 0.55, size: pr === 3 ? 0.4 + 0.5 * x : 0.8, decay: p.sus ? 0.99 : p.decay ?? 0.55 };
      },
      desc: 'HALL, PLATE, LO-FI (filtered, wobbly) and REFLECTION (echo-y early reflections). X = modulation / lo-fi wobble / reflection size. SUSTAIN latches an endless tail.',
    }),
    // ---------------- Mako-style big boxes
    WA({
      id: 'wa.makod1', name: 'Thresher D1 Delay', ref: 'Walrus Audio Mako D1', logo: 'THRESHER D1', tagline: 'HIGH-FIDELITY STEREO DELAY', cat: 'Delay',
      color: '#2e3c49', ink: 'silver', scene: 'mako', size: 'x', stereo: 'both', cost: 1.2, noStd: true,
      algo: 'delay', opts: { maxMs: 2500 },
      controls: [
        K('time', 'TIME', { min: 30, max: 2000, def: 420, display: ms, curve: 'log' }), K('feedback', 'REPEATS', { def: 0.4, max: 1.05 }), K('mix', 'MIX', { def: 0.35 }),
        K('tone', 'TONE', { def: 0.6 }), K('modrate', 'RATE', { def: 0.3 }), K('moddepth', 'DEPTH', { def: 0.15 }),
        SEL('mode', 'PROGRAM', ['DIG', 'ANA', 'TAPE', 'MOD', 'DUAL'], { values: [0, 1, 2, 4, 8], def: 0, togRow: true, r: 11 }),
        TOG('subdiv', 'DIV', ['1/4', 'dot', 'trip'], { values: [0, 1, 3] }), TOG('age', 'AGE', ['new', 'used', 'worn'], { values: [0, 0.35, 0.75] }),
        FOOT({ action: 'tap', label: 'TAP', hold: { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }), bypassFoot(),
        LED({ bind: 'tap:time', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      desc: 'Programs: digital, analog, tape, modulated and dual delay. Hold TAP for infinite repeats.',
    }),
    WA({
      id: 'wa.makor1', name: 'Thresher R1 Reverb', ref: 'Walrus Audio Mako R1', logo: 'THRESHER R1', tagline: 'HIGH-FIDELITY STEREO REVERB', cat: 'Reverb',
      color: '#3b3046', ink: 'silver', scene: 'mako', size: 'x', stereo: 'both', cost: 1.6, noStd: true,
      algo: 'reverb',
      controls: [
        K('decay', 'DECAY', { def: 0.55 }), K('mix', 'MIX', { def: 0.35 }), K('predelay', 'PRE-DLY', { min: 0, max: 400, def: 20, display: ms }),
        K('tone', 'TONE', { def: 0.55 }), K('mod', 'MOD', { def: 0.3 }), K('size', 'X', { def: 0.6 }),
        SEL('mode', 'PROGRAM', ['HALL', 'PLATE', 'SPRG', 'ROOM', 'BLOOM'], { values: [1, 2, 3, 0, 5], def: 0, togRow: true, r: 11 }),
        TOG('lowcut', 'LOW CUT', ['off', 'lo', 'hi'], { values: [0.05, 0.25, 0.5] }), TOG('diffusion', 'DIFFUSE', ['lo', 'mid', 'hi'], { values: [0.4, 0.7, 0.9], def: 1 }),
        FOOT({ action: 'param', p: 'sus', toggle: true, label: 'SUSTAIN' }), bypassFoot(),
        LED({ bind: 'param:sus', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      derive: (p) => (p.sus ? { decay: 0.99 } : {}),
    }),
    WA({
      id: 'wa.makom1', name: 'Thresher M1 Modulation', ref: 'Walrus Audio Mako M1', logo: 'THRESHER M1', tagline: 'HIGH-FIDELITY MODULATION', cat: 'Modulation',
      color: '#2e4541', ink: 'silver', scene: 'mako', size: 'x', stereo: 'both', cost: 1.2, noStd: true,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'c', algo: 'chorus' }, { prefix: 'p', algo: 'phaser', opts: { stages: 6 }, on: false }, { prefix: 'f', algo: 'flanger', on: false },
        { prefix: 't', algo: 'tremolo', on: false }, { prefix: 'v', algo: 'chorus', params: { mode: 1, mix: 1 }, on: false },
      ] },
      controls: [
        K('rate', 'RATE', { def: 0.35, virtual: true }), K('depth', 'DEPTH', { def: 0.5, virtual: true }), K('mix', 'MIX', { def: 0.5, virtual: true }),
        K('tone', 'TONE', { def: 0.5, virtual: true }), K('shape', 'SHAPE', { def: 0.3, virtual: true }), K('x', 'X', { def: 0.4, virtual: true }),
        SEL('prog', 'PROGRAM', ['CHOR', 'PHAS', 'FLNG', 'TREM', 'VIBE'], { def: 0, virtual: true, togRow: true, r: 11 }),
        TOG('rmult', 'RANGE', ['slow', 'norm', 'fast'], { def: 1, virtual: true }), TOG('lvl', 'LEVEL', ['-3', '0', '+3'], { def: 1, virtual: true }),
        FOOT({ action: 'favorite', label: 'PRESET' }), bypassFoot(), LED({ bind: 'fav', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      derive: (p) => {
        const pr = p.prog ?? 0, r = Math.max(0, Math.min(1, (p.rate ?? 0.35) + [-0.2, 0, 0.2][p.rmult ?? 1])), d = p.depth ?? 0.5, mx = p.mix ?? 0.5, x = p.x ?? 0.4;
        const lv = [0.42, 0.5, 0.58][p.lvl ?? 1];
        return {
          'c.on': pr === 0 ? 1 : 0, 'p.on': pr === 1 ? 1 : 0, 'f.on': pr === 2 ? 1 : 0, 't.on': pr === 3 ? 1 : 0, 'v.on': pr === 4 ? 1 : 0,
          'c.rate': r, 'c.depth': d, 'c.mix': mx, 'c.tone': p.tone ?? 0.5, 'c.wave': p.shape ?? 0.3, 'c.feedback': x * 0.5, 'c.level': lv,
          'p.rate': r, 'p.depth': d, 'p.mix': mx, 'p.feedback': x * 0.85, 'p.center': p.tone ?? 0.5,
          'f.speed': r, 'f.width': d, 'f.mix': mx, 'f.regen': x, 'f.manual': p.tone ?? 0.5,
          't.rate': r, 't.depth': d, 't.wave': p.shape ?? 0.3, 't.mode': x > 0.5 ? 1 : 0, 't.level': lv,
          'v.rate': r, 'v.depth': d, 'v.tone': p.tone ?? 0.5, 'v.wave': p.shape ?? 0.3, 'v.level': lv,
        };
      },
      desc: 'Five programs (chorus, phaser, flanger, tremolo, vibrato). X = feedback / regen / harmonic trem. The left switch recalls / saves (hold) a preset.',
    }),
    WA({
      id: 'wa.makoacs1', name: 'Thresher ACS Amp & Cab', ref: 'Walrus Audio ACS1', logo: 'THRESHER ACS', tagline: 'STEREO AMP + CAB SIMULATOR', cat: 'Preamp', kind: 'Preamp',
      color: '#463b2d', ink: 'gold', scene: 'mako', size: 'x', stereo: 'both', cost: 5, noStd: true,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'b', algo: 'drive', opts: { clip: 'clean', gainMinDb: 0, gainMaxDb: 14, tone: 'none', levelMaxDb: 0 }, on: false },
        { prefix: 'a', algo: 'amp', opts: { models: ['deluxe', 'ac30', 'dumble'] } },
        { prefix: 'c', algo: 'cab', opts: { models: ['1x12us', '2x12blue', '4x12gb'] } },
        { prefix: 'r', algo: 'reverb', params: { mode: 0, decay: 0.3, size: 0.35 } },
      ] },
      controls: [
        K('a.level', 'VOLUME', { min: -24, max: 6, def: 0, display: db }), K('a.gain', 'GAIN', { def: 0.45 }), K('r.mix', 'ROOM', { min: 0, max: 0.5, def: 0.12 }),
        K('a.bass', 'BASS', { def: 0.5 }), K('a.mid', 'MID', { def: 0.5 }), K('a.treble', 'TREBLE', { def: 0.55 }),
        TOG('a.channel', 'AMP', ['CA', 'UK', 'ODS']), TOG('c.model', 'CAB', ['1x12', '2x12', '4x12']), TOG('bgain', 'BOOST', ['+6', '+10', '+14'], { def: 1, virtual: true }),
        FOOT({ action: 'param', p: 'b.on', toggle: true, label: 'BOOST' }), bypassFoot(),
        LED({ bind: 'param:b.on', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      derive: (p) => ({ 'b.gain': [0.43, 0.71, 1][p.bgain ?? 1], 'b.level': 0.99 }),
      initParams: { 'b.on': 0 },
      desc: 'Three amps (US combo, UK top-boost, overdrive special) into 1x12 / 2x12 / 4x12 cabs, with room reverb and a clean boost switch. Stereo in/out.',
    }),
    // ---------------- delay / textures
    WA({
      id: 'wa.arp87', name: 'ARC-78 Multi-Function Delay', ref: 'Walrus Audio ARP-87', logo: 'ARC-78', tagline: 'MULTI-FUNCTION DELAY', cat: 'Delay',
      color: '#2b2e34', ink: 'silver', scene: 'geo', size: 'w', stereo: 'both', noStd: true,
      algo: 'delay', opts: { maxMs: 1600 },
      controls: [
        K('dt', 'TIME', { min: 30, max: 1500, def: 400, display: ms, curve: 'log' }), K('feedback', 'REPEATS', { def: 0.4, max: 1.05 }), K('mix', 'MIX', { def: 0.35 }),
        K('x', 'X', { def: 0.5, virtual: true }), SEL('prog', 'PROGRAM', ['DIG', 'ANA', 'LOFI', 'SLAP'], { def: 0, virtual: true }),
        TOG('subdiv', 'RATIO', ['1/4', 'dot', 'trip'], { values: [0, 1, 3] }), TOG('mod', 'MOD', ['off', 'on'], { virtual: true }),
        FOOT({ action: 'tap', label: 'TAP', tapTarget: 'dt' }), bypassFoot(), LED({ bind: 'tap:time', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      rows: [3, 2],
      derive: (p) => {
        const pr = p.prog ?? 0, x = p.x ?? 0.5, t = p.dt ?? 400;
        return { mode: [0, 1, 3, 1][pr], time: pr === 3 ? 40 + (t / 1500) * 180 : t, tone: pr === 2 ? 0.25 + 0.3 * x : 0.3 + 0.7 * x, age: pr === 2 ? 0.3 + 0.6 * x : 0.2, moddepth: p.mod ? 0.25 : 0, modrate: 0.35 };
      },
    }),
    WA({
      id: 'wa.fable', name: 'Parable Granular Soundscape', ref: 'Walrus Audio Fable', logo: 'PARABLE', tagline: 'GRANULAR SOUNDSCAPE', cat: 'Delay',
      color: '#283451', ink: 'gold', scene: 'book', size: 'w', stereo: 'both', cost: 1.6, noStd: true,
      algo: 'chain', opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 2000 }, params: { mode: 4 } }, { prefix: 'r', algo: 'reverb', params: { mode: 5 } }] },
      controls: [
        K('d.time', 'GRAIN', { min: 40, max: 1600, def: 320, display: ms, curve: 'log' }), K('d.feedback', 'DENSITY', { def: 0.55, max: 1.0 }), K('d.mix', 'MIX', { def: 0.45 }),
        K('d.moddepth', 'SCATTER', { def: 0.45 }), K('r.mix', 'SPACE', { def: 0.35 }), SEL('prog', 'PROGRAM', ['CLOUD', 'SHIM', 'REV', 'TAPE'], { def: 0, virtual: true }),
        FOOT({ action: 'tap', label: 'HOLD', tapTarget: 'd.time', hold: { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }), bypassFoot(),
        LED({ bind: 'tap:d.time', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      derive: (p) => ({ 'd.mode': [4, 6, 5, 2][p.prog ?? 0], 'd.modrate': 0.55, 'r.decay': 0.7, 'r.mod': 0.5 }),
      desc: 'Granular textures approximated with modulated / shimmer / reverse / tape delay lines smeared into a cloud reverb. Hold the left switch to freeze.',
    }),
    WA({
      id: 'wa.lore', name: 'Legend Reverse Soundscape', ref: 'Walrus Audio Lore', logo: 'LEGEND', tagline: 'REVERSE SOUNDSCAPE GENERATOR', cat: 'Reverb',
      color: '#3b302a', ink: 'gold', scene: 'moth', size: 'w', stereo: 'both', cost: 2.2, noStd: true,
      algo: 'chain', opts: { chain: [
        { prefix: 'd', algo: 'delay', opts: { maxMs: 2000 }, params: { mode: 5 } },
        { prefix: 'r', algo: 'reverb', params: { mode: 1 } },
        { prefix: 'p', algo: 'pitch', params: { semis1: -12, level1: 0.5, dry: 1, semis2: 12, level2: 0 }, on: false },
      ] },
      controls: [
        K('d.time', 'TIME', { min: 100, max: 1800, def: 600, display: ms, curve: 'log' }), K('d.feedback', 'REPEATS', { def: 0.45 }), K('d.mix', 'MIX', { def: 0.5 }),
        K('r.decay', 'DECAY', { def: 0.6 }), K('r.mix', 'VERB', { def: 0.4 }), SEL('pitch', 'PITCH', ['-OCT', 'OFF', '+OCT', '±OCT'], { def: 1, virtual: true }),
        FOOT({ action: 'tap', label: 'TAP', tapTarget: 'd.time' }), bypassFoot(), LED({ bind: 'tap:d.time', color: '#ff3a24' }), LED({ bind: 'on', color: '#ff3a24' }),
      ],
      derive: (p) => {
        const pi = p.pitch ?? 1;
        return { 'p.on': pi === 1 ? 0 : 1, 'p.level1': pi === 0 || pi === 3 ? 0.5 : 0, 'p.level2': pi >= 2 ? 0.45 : 0, 'r.mode': 1 };
      },
      desc: 'Reverse delay into a hall, with optional octave layers (approximation of the real pitch-shifted reverse textures).',
    }),
    // ---------------- drives
    WA({
      id: 'wa.eras', name: 'Epochs Distortion', ref: 'Walrus Audio Eras', logo: 'EPOCHS', tagline: 'FIVE-STATE DISTORTION', cat: 'Distortion',
      color: '#1e1d23', ink: 'gold', scene: 'eye',
      algo: 'drive', opts: { tone: 'eq3', eqRangeDb: 12, bassF: 100, midF: 700, trebleF: 3000, gainMinDb: 8, gainMaxDb: 46, levelMaxDb: 2, postLp: 8000, preHp: 50,
        modes: [{ clip: 'si' }, { clip: 'si', bias: 0.3 }, { clip: 'led', gainMaxDb: 50 }, { clip: 'mosfet', stages: 2, stage2Db: 6 }, { clip: 'diode', stages: 2, stage2Db: 10, gainMaxDb: 50 }] },
      fixed: { mid: 0.45 },
      controls: [
        K('level', 'VOLUME', { def: 0.45 }), K('bass', 'BASS', { def: 0.5 }), K('treble', 'TREBLE', { def: 0.55 }),
        K('blend', 'BLEND', { def: 1 }), K('gain', 'GAIN', { def: 0.5 }), SEL('mode', 'MODE', ['1', '2', '3', '4', '5'], { def: 2 }),
      ],
    }),
    WA({
      id: 'wa.ages', name: 'Eons Overdrive', ref: 'Walrus Audio Ages', logo: 'EONS', tagline: 'FIVE-STATE OVERDRIVE', cat: 'Overdrive',
      color: '#bfae86', ink: '#2c2218', scene: 'mountains',
      algo: 'drive', opts: { tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 2800, gainMinDb: 0, gainMaxDb: 38, levelMaxDb: 8, postLp: 9000, preHp: 60,
        modes: [{ clip: 'ts', cleanSum: true, cleanMix: 0.3 }, { clip: 'asym' }, { clip: 'jfet', bias: 0.2 }, { clip: 'diode', bias: 0.15, gainMaxDb: 42 }, { clip: 'tube', stages: 2, stage2Db: 8, gainMaxDb: 44 }] },
      fixed: { mid: 0.55 },
      controls: [
        K('level', 'VOLUME', { def: 0.5 }), K('treble', 'TREBLE', { def: 0.55 }), K('bass', 'BASS', { def: 0.5 }),
        K('drv', 'GAIN', { def: 0.5, virtual: true }), K('trim', 'TRIM', { def: 0.6, virtual: true }), SEL('mode', 'MODE', ['1', '2', '3', '4', '5'], { def: 0 }),
      ],
      derive: (p) => ({ gain: (p.drv ?? 0.5) * (0.45 + 0.55 * (p.trim ?? 0.6)) }),
      desc: 'TRIM sets how hard the gain stage is hit (the range of the GAIN knob).',
    }),
    WA({
      id: 'wa.mayflower', name: 'Pilgrim Overdrive', ref: 'Walrus Audio Mayflower', logo: 'PILGRIM', tagline: 'OVERDRIVE', cat: 'Overdrive',
      color: '#2d4c66', ink: '#efe6cf', scene: 'ship',
      algo: 'drive', opts: { clip: 'asym', tone: 'tilt', eqRangeDb: 10, bassF: 160, trebleF: 2200, gainMinDb: 2, gainMaxDb: 32, levelMaxDb: 8, postLp: 9500, preHp: 45, modes: [{}, { gainMaxDb: 42, clip: 'diode' }] },
      controls: [K('level', 'VOLUME', { def: 0.5 }), K('gain', 'GAIN', { def: 0.45 }), K('bass', 'BASS', { def: 0.5 }), K('treble', 'TREBLE', { def: 0.5 }), TOG('mode', 'GAIN', ['lo', 'hi'])],
      rows: [2, 2],
    }),
    WA({
      id: 'wa.ironhorse', name: 'Iron Mare Distortion', ref: 'Walrus Audio Iron Horse V3', logo: 'IRON MARE', tagline: 'LM308 DISTORTION', cat: 'Distortion',
      color: '#3a3a3c', ink: 'copper', scene: 'horse',
      algo: 'drive', opts: { tone: 'rat', slew: 0.3, gainMinDb: 6, gainMaxDb: 52, levelMaxDb: 0, preHp: 40, modes: [{ clip: 'si' }, { clip: 'led' }, { clip: 'opamp', bias: 0.1 }] },
      controls: [K('level', 'VOLUME', { def: 0.45 }), K('tone', 'TONE', { def: 0.45 }), K('gain', 'DRIVE', { def: 0.5 }), TOG('mode', 'CLIP', ['smth', 'led', 'open'], { def: 0 })],
    }),
    WA({
      id: 'wa.voyager', name: 'Wayfarer Preamp/OD', ref: 'Walrus Audio Voyager', logo: 'WAYFARER', tagline: 'PREAMP / OVERDRIVE', cat: 'Overdrive',
      color: '#1f3b39', ink: 'silver', scene: 'planet',
      algo: 'drive', opts: { clip: 'opamp', tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3000, gainMinDb: 0, gainMaxDb: 40, levelMaxDb: 8, postLp: 8500,
        modes: [{}, { preEq: [{ type: 'peak', f: 900, q: 0.9, db: 5 }] }] },
      fixed: { mid: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.5 }), K('gain', 'GAIN', { def: 0.45 }), K('bass', 'BASS', { def: 0.5 }), K('treble', 'TREBLE', { def: 0.55 }), TOG('mode', 'MIDS', ['flat', 'boost'])],
      rows: [2, 2],
    }),
    WA({
      id: 'wa.emissary', name: 'Envoy Parallel Boost', ref: 'Walrus Audio Emissary', logo: 'ENVOY', tagline: 'PARALLEL BOOST', cat: 'Boost',
      color: '#8a2c2a', ink: 'gold', scene: 'bird',
      algo: 'drive', opts: { clip: 'jfet', tone: 'tilt', eqRangeDb: 10, bassF: 150, trebleF: 2500, gainMinDb: 0, gainMaxDb: 22, levelMinDb: -20, levelMaxDb: 12, modes: [{}, { gainMaxDb: 34, clip: 'asym' }] },
      controls: [K('level', 'VOLUME', { def: 0.6 }), K('gain', 'GAIN', { def: 0.35 }), K('blend', 'BLEND', { def: 0.6 }), K('bass', 'BASS', { def: 0.5 }), K('treble', 'TREBLE', { def: 0.5 }), TOG('mode', 'GAIN', ['lo', 'hi'])],
    }),
    WA({
      id: 'wa.kangra', name: 'Kangri Filter Fuzz', ref: 'Walrus Audio Kangra', logo: 'KANGRI', tagline: 'FILTER FUZZ', cat: 'Fuzz',
      color: '#7a3b29', ink: 'gold', scene: 'temple', cost: 1,
      algo: 'chain', opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'muff', stages: 2, stage2Db: 12, tone: 'none', gainMinDb: 18, gainMaxDb: 52, levelMinDb: -40, levelMaxDb: -6, preHp: 60, postLp: 7000 } },
        { prefix: 'w', algo: 'wah', opts: { mode: 0, fLo: 220, fHi: 3400, q: 3 } },
      ] },
      controls: [K('f.level', 'VOLUME', { def: 0.5 }), K('f.gain', 'FUZZ', { def: 0.6 }), K('w.pos', 'FILTER', { def: 0.5 }), K('w.q', 'RESO', { def: 0.45 }), TOG('w.filter', 'MODE', ['LP', 'BP', 'HP'], { def: 1 })],
      rows: [2, 2],
    }),
    // ---------------- dynamics / bass / combos
    WA({
      id: 'wa.deepsix', name: 'Deep Seven Compressor', ref: 'Walrus Audio Deep Six V3', logo: 'DEEP SEVEN', tagline: 'COMPRESSOR', cat: 'Dynamics',
      color: '#d6d2c5', ink: '#1d1b19', scene: 'anchor',
      algo: 'comp', opts: { type: 'ota' },
      controls: [K('level', 'LEVEL', { def: 0.5 }), K('sustain', 'SUSTAIN', { def: 0.5 }), K('blend', 'BLEND', { def: 0.7 }), K('attack', 'ATTACK', { def: 0.3 }), TOG('release', 'RELEASE', ['fast', 'slow'], { values: [0.25, 0.65] })],
      rows: [2, 2],
    }),
    WA({
      id: 'wa.badwater', name: 'Saltflat Bass Preamp & DI', ref: 'Walrus Audio Badwater', logo: 'SALTFLAT', tagline: 'BASS PREAMP & D.I.', cat: 'Preamp', kind: 'Preamp',
      color: '#c4b393', ink: '#2c2419', scene: 'desert', size: 'w', tags: ['bass', 'di'],
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'DI OUT'] }, jackKinds: { o1: 'xlr' },
      algo: 'drive', opts: { clip: 'jfet', tone: 'eq3', eqRangeDb: 15, bassF: 80, midF: 500, trebleF: 3500, midMin: 200, midMax: 1600, gainMinDb: 0, gainMaxDb: 30, levelMinDb: -20, levelMaxDb: 20, preHp: 25, postLp: 9000 },
      controls: [
        K('level', 'VOLUME', { def: 0.5 }), K('gain', 'DRIVE', { def: 0.2 }), K('blend', 'BLEND', { def: 0.5 }),
        K('bass', 'BASS', { def: 0.5 }), K('mid', 'MID', { def: 0.5 }), K('treble', 'TREBLE', { def: 0.5 }),
        TOG('midfreq', 'MID FREQ', ['250', '500', '1k'], { values: [0.2, 0.5, 0.8], def: 1 }),
      ],
      desc: 'Bass preamp with a clean / drive blend and a balanced DI output (both outputs carry the processed signal).',
    }),
    WA({
      id: 'wa.melee', name: 'Skirmish Wall of Noise', ref: 'Walrus Audio Melee', logo: 'SKIRMISH', tagline: 'WALL OF NOISE · DISTORTION + REVERB', cat: 'Distortion',
      color: '#4a2b3a', ink: 'silver', scene: 'swords', size: 'w', cost: 1.6, noStd: true,
      algo: 'chain', opts: { chain: [
        { prefix: 'd', algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 8, tone: 'lp', toneLo: 1500, toneHi: 8000, gainMinDb: 10, gainMaxDb: 50, levelMaxDb: 6, preHp: 60 } },
        { prefix: 'r', algo: 'reverb', params: { mode: 1 } },
      ] },
      controls: [
        K('d.level', 'VOLUME', { def: 0.5 }), K('d.gain', 'GAIN', { def: 0.55 }), K('d.tone', 'TONE', { def: 0.5 }),
        K('r.decay', 'DECAY', { def: 0.6 }), K('r.mix', 'MIX', { def: 0.4 }), K('r.tone', 'FILTER', { def: 0.5 }),
        TOG('rmode', 'VERB', ['room', 'hall', 'mod'], { def: 1, virtual: true }),
        FOOT({ action: 'param', p: 'd.on', toggle: true, label: 'DRIVE' }), FOOT({ action: 'param', p: 'r.on', toggle: true, label: 'REVERB' }),
        LED({ bind: 'param:d.on', color: '#ff3a24' }), LED({ bind: 'param:r.on', color: '#ff3a24' }),
      ],
      derive: (p) => ({ 'r.mode': [0, 1, 6][p.rmode ?? 1] }),
      alwaysOn: true, initParams: { 'd.on': 1, 'r.on': 1 },
    }),
    // ---------------- Fundamental series
    FU({ id: 'wa.fdrive', name: 'Basic Drive', ref: 'Walrus Audio Fundamental Drive', logo: 'BASIC', tagline: 'DRIVE', cat: 'Overdrive', accent: '#e58a3a',
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 650, gainMinDb: 2, gainMaxDb: 40, tone: 'lp', toneLo: 1200, toneHi: 8000, levelMaxDb: 6, modes: [{ postLp: 6000 }, { gainMaxDb: 46, clip: 'asym' }, { postLp: 10000, preEq: [{ type: 'hs', f: 2500, q: 0.7, db: 3 }] }] },
      controls: [sl('gain', 'GAIN', { def: 0.45 }), sl('tone', 'TONE'), sl('level', 'VOLUME'), TOG('mode', 'MODE', ['SMOOTH', 'CRUNCH', 'BRIGHT'])],
      desc: 'Simple overdrive with smooth, crunch and bright modes.' }),
    FU({ id: 'wa.fdist', name: 'Basic Distortion', ref: 'Walrus Audio Fundamental Distortion', logo: 'BASIC', tagline: 'DISTORTION', cat: 'Distortion', accent: '#d8423a',
      algo: 'drive', opts: { clip: 'si', preHp: 70, gainMinDb: 10, gainMaxDb: 52, tone: 'lp', toneLo: 1000, toneHi: 7500, postLp: 8000, levelMaxDb: -3, modes: [{ preEq: [{ type: 'ls', f: 150, q: 0.7, db: 4 }], postLp: 5500 }, {}, { clip: 'led', gainMaxDb: 54 }] },
      controls: [sl('gain', 'GAIN', { def: 0.5 }), sl('tone', 'TONE'), sl('level', 'VOLUME'), TOG('mode', 'MODE', ['DARK', 'SILICON', 'LED'], { def: 1 })],
      desc: 'Distortion from dark and doomy to sharp LED-clipped leads.' }),
    FU({ id: 'wa.ffuzz', name: 'Basic Fuzz', ref: 'Walrus Audio Fundamental Fuzz', logo: 'BASIC', tagline: 'FUZZ', cat: 'Fuzz', accent: '#9a6ad8',
      algo: 'drive', opts: { clip: 'muff', stages: 2, stage2Db: 14, preHp: 80, gainMinDb: 16, gainMaxDb: 50, tone: 'blend', blendLp: 450, blendHp: 1100, postLp: 8500, levelMaxDb: -2, modes: [{}, { preEq: [{ type: 'peak', f: 900, q: 0.8, db: 5 }] }, { clip: 'si', bias: 0.6 }] },
      controls: [sl('gain', 'GAIN', { def: 0.6 }), sl('tone', 'TONE'), sl('level', 'VOLUME'), TOG('mode', 'MODE', ['CLASSIC', 'MID+', 'GATE'])],
      desc: 'Sustaining fuzz with a classic scoop, a mid boost or a gated, sputtery mode.' }),
    FU({ id: 'wa.ftrem', name: 'Basic Tremolo', ref: 'Walrus Audio Fundamental Tremolo', logo: 'BASIC', tagline: 'TREMOLO', cat: 'Modulation', accent: '#4ab0d8',
      algo: 'tremolo', fixed: { mode: 0 },
      controls: [sl('rate', 'RATE', { def: 0.4 }), sl('depth', 'DEPTH', { def: 0.6 }), sl('level', 'VOLUME'), TOG('wave', 'WAVE', ['SINE', 'SQUARE', 'RANDOM'], { values: [0.3, 1, 0.6] })],
      desc: 'Optical-style tremolo with sine, square and random shapes.' }),
    FU({ id: 'wa.fchorus', name: 'Basic Chorus', ref: 'Walrus Audio Fundamental Chorus', logo: 'BASIC', tagline: 'CHORUS', cat: 'Modulation', accent: '#5cc28a',
      algo: 'chorus',
      controls: [sl('rate', 'RATE', { def: 0.35 }), sl('depth', 'DEPTH', { def: 0.5 }), sl('mix', 'MIX', { def: 0.5 }), TOG('voice', 'MODE', ['LIGHT', 'MEDIUM', 'HEAVY'], { def: 1, virtual: true })],
      derive: (p) => ({ delay: [0.35, 0.5, 0.7][p.voice ?? 1], depth: (p.depth ?? 0.5) * [0.6, 1, 1.3][p.voice ?? 1] }),
      desc: 'Bucket-brigade style chorus, from light shimmer to heavy warble.' }),
    FU({ id: 'wa.fphaser', name: 'Basic Phaser', ref: 'Walrus Audio Fundamental Phaser', logo: 'BASIC', tagline: 'PHASER', cat: 'Modulation', accent: '#e0c040',
      algo: 'phaser', opts: { stages: 4 }, fixed: { mix: 0.5 },
      controls: [sl('rate', 'RATE', { def: 0.35 }), sl('depth', 'DEPTH', { def: 0.8 }), sl('feedback', 'FEEDBACK', { def: 0.35 }), TOG('stages', 'MODE', ['LIGHT', 'MEDIUM', 'HEAVY'], { values: [2, 4, 8], def: 1 })],
      desc: 'Classic phaser with light, medium and heavy sweeps.' }),
    FU({ id: 'wa.fdelay', name: 'Basic Delay', ref: 'Walrus Audio Fundamental Delay', logo: 'BASIC', tagline: 'DELAY', cat: 'Delay', accent: '#e86a8a',
      algo: 'delay', opts: { maxMs: 1200 },
      controls: [K('time', 'TIME', { t: 'slider', min: 40, max: 1100, def: 380, title: 'TIME', label: '' }), sl('feedback', 'FEEDBACK', { def: 0.4, max: 1.05 }), sl('mix', 'MIX', { def: 0.35 }), TOG('mode', 'MODE', ['DIGITAL', 'ANALOG', 'REVERSE'], { values: [0, 1, 5] })],
      desc: 'Digital, analog and reverse delay.' }),
    FU({ id: 'wa.freverb', name: 'Basic Reverb', ref: 'Walrus Audio Fundamental Reverb', logo: 'BASIC', tagline: 'REVERB', cat: 'Reverb', accent: '#7a9ae8', cost: 1,
      algo: 'reverb',
      controls: [sl('decay', 'DECAY', { def: 0.5 }), sl('tone', 'TONE', { def: 0.55 }), sl('mix', 'MIX', { def: 0.35 }), TOG('mode', 'MODE', ['HALL', 'SPRING', 'PLATE'], { values: [1, 3, 2] })],
      desc: 'Hall, spring and plate reverb.' }),
  ]);
}
