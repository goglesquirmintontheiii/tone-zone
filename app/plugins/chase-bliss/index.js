// Built-in Tone Zone plugin: Chase Bliss.
// Blocks inspired by Chase Bliss pedals. Names, logos and artwork are Tone Zone originals; control counts, labels,
// layouts, toggle positions, footswitch functions and colours follow the real units (see each block's `ref`).
//
// One custom enclosure family ("chase") serves the pedals: a 125B-style portrait box (or the slightly larger stereo
// MKII box) with full-face printed art drawn from a few dozen SVG paths per pedal (`art` + `palette`), two rows of
// small knobs, a row of 3-way toggles, the little PRESET toggle between the two footswitches and a DIP switch bank on
// the top face (an interactive screen: the labelled switches really work). "chase-desk" is the wide motorised-fader
// desktop box (reverb / echo).
//
// Wet-only lanes: delay, reverb and looper blocks always pass their dry signal, so a "wet lane" is a nested chain of
// the effect and an inverted utility running in parallel (x + wet − x = wet). That lets pitch / modulation / looping
// act on the echoes only, and lets a pedal sum a dry lane with several wet lanes (lanes always on, levels via
// `<lane>.lvl`, the parallel normalisation made up by a fixed post gain).
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, def, ms, MONO, STEREO } = tz.helpers;
  const { svg, label, shade, formKit, setA } = tz.gfx;

  // ------------------------------------------------------------------ small maths
  const c01 = (v) => Math.max(0, Math.min(1, v));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lmap = (t, lo, hi) => lo * Math.pow(hi / lo, c01(t));
  const dB = (g) => (g <= 0.001 ? -60 : 20 * Math.log10(g));
  const rateT = (hz, lo, hi) => c01(Math.log(hz / lo) / Math.log(hi / lo));
  const up = (v) => 2 * Math.min(1, 2 * v); // lane level: 0 → 2 by the middle of a knob
  const dn = (v) => 2 * Math.min(1, 2 * (1 - v));
  const pick = (v, arr) => arr[Math.max(0, Math.min(arr.length - 1, Math.round(c01(v) * (arr.length - 1))))];
  const SEMIS = [-24, -19, -12, -7, -5, 0, 5, 7, 12, 19, 24];
  const sgn = (v) => (v > 0 ? '+' : '') + v;
  const semiTxt = (v) => { const s = pick(v, SEMIS); return s === 0 ? 'off' : sgn(s) + ' st'; };
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  const rng = (seed) => { let s = seed % 2147483647 || 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

  // ------------------------------------------------------------------ chain building blocks
  const DRY = (prefix, group, lvl = 2) => ({ prefix, algo: 'utility', group, lvlDef: lvl });
  const WET = (prefix, algo, o = {}) => ({
    prefix, algo: 'chain', group: o.group, lvlDef: o.lvl ?? 0,
    opts: { chain: [
      { prefix: 'x', algo, opts: o.opts || {}, params: o.params || {}, group: 1, lvlDef: 2 },
      { prefix: 'n', algo: 'utility', group: 1, lvlDef: 2, params: { invert: 1 } },
      ...(o.post || []),
    ] },
  });
  const POST = (prefix, db) => ({ prefix, algo: 'utility', params: { level: db } });

  // ------------------------------------------------------------------ footswitch behaviour (block hooks)
  // FOOT({cb: {tap, hold, release, down, up, holdMs}}): tap 'bypass' leaves the press to the editor (bypass,
  // momentary bypass); anything else is a function (c) with c.ui, c.set(p, v), c.toggle(p), c.ev(prefix, type,
  // value, innerArg), c.tapMs().
  const taps = new Map();
  const holds = new Map();
  function ctxFor(v) {
    const b = v.block, d = v.def, id = b.id, ui = tz.app.ui(b);
    const idx = (pre) => (d.opts.chain || []).findIndex((s) => s.prefix === pre);
    return {
      ui, id,
      set: (p, x) => tz.app.setParam(id, p, x),
      toggle: (p) => tz.app.setParam(id, p, (ui[p] ?? 0) > 0.5 ? 0 : 1),
      ev: (pre, type, value = 0, inner = 0) => tz.engine.send({ cmd: 'event', id, type, value, arg: (pre ? Math.max(0, idx(pre)) * 100 : 0) + inner }),
      tapMs() {
        const now = performance.now(), last = taps.get(id) || 0;
        taps.set(id, now);
        const dt = now - last;
        return dt > 80 && dt < 3000 ? dt : null;
      },
    };
  }
  const hooked = new Set();
  function hookFeet(d) {
    if (hooked.has(d.id) || !d.controls.some((c) => c.cb)) return;
    hooked.add(d.id);
    tz.blockHooks(d.id, {
      foot(v, c, down) {
        const cb = c.cb;
        if (!cb) return false;
        const key = v.block.id + '|' + c.cid;
        if (down) {
          const st = { held: false, timer: 0 };
          holds.set(key, st);
          if (cb.down) cb.down(ctxFor(v));
          if (cb.hold) st.timer = setTimeout(() => { st.held = true; cb.hold(ctxFor(v)); }, cb.holdMs || 650);
          return cb.tap !== 'bypass';
        }
        const st = holds.get(key) || { held: false };
        clearTimeout(st.timer);
        holds.delete(key);
        const cx = ctxFor(v);
        if (cb.up) cb.up(cx);
        if (st.held) { if (cb.release) cb.release(cx); return true; }
        if (cb.tap === 'bypass') return false;
        if (cb.tap) cb.tap(cx);
        return true;
      },
    });
  }
  // tap tempo → LFO knob (rate param mapped log lo..hi Hz), mul = tap division
  const tapRate = (c, p, lo, hi, mul = 1) => { const dt = c.tapMs(); if (dt) c.set(p, rateT((1000 / dt) * mul, lo, hi)); };
  const tapTime = (c, p, lo = 20, hi = 3000) => { const dt = c.tapMs(); if (dt) c.set(p, clamp(dt, lo, hi)); };
  // nested looper / microloop status → LED colour
  const LOOP_COL = [null, '#ff3b30', '#3ddc84', '#ffb21f', '#f4f4f4'];
  const loopLed = (path, mode = 'state') => (ui, b, st, now) => {
    let s = st;
    for (const k of path) s = s?.[k];
    const t = s?.looper?.tracks?.[0];
    if (!t) return null;
    if (mode === 'stop') return t.state === 4 ? '#ff3b30' : null;
    if (t.state === 1 && now % 500 < 250) return null;
    return LOOP_COL[t.state] || null;
  };

  // ------------------------------------------------------------------ screens: DIP bank, cycle buttons, LCD
  tz.addScreen('chase-dips', {
    build(s, g, w, h) {
      const c = s.ctl, dips = c.dips, n = dips.length, sw = w / n;
      s.sw = sw;
      svg('rect', { x: 0, y: 0, width: w, height: 10.5, rx: 1.2, fill: c.housing || '#c9252b', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.4 }, g);
      svg('rect', { x: 0.6, y: 0.5, width: w - 1.2, height: 2, rx: 1, fill: '#fff', 'fill-opacity': 0.18 }, g);
      s.k = [];
      dips.forEach((dp, i) => {
        const x = i * sw + sw / 2;
        svg('rect', { x: x - 2.3, y: 1.6, width: 4.6, height: 7.4, rx: 0.6, fill: '#3a0b0d' }, g);
        const k = svg('rect', { x: x - 1.9, y: 5.2, width: 3.8, height: 3.4, rx: 0.5, fill: '#f6f2ea' }, g);
        s.k.push(k);
        const live = typeof dp === 'object';
        svg('text', { x, y: 13.7, fill: c.ink || '#fff', 'fill-opacity': live ? 1 : 0.62, 'font-family': "'Barlow Condensed', sans-serif", 'font-weight': 700, 'font-size': c.fs || 3.3, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'pointer-events': 'none' }, g, live ? dp.l : dp);
        if (live) svg('circle', { cx: x, cy: 16.7, r: 0.7, fill: c.ink || '#fff' }, g);
      });
      svg('rect', { width: w, height: h, fill: 'transparent' }, g);
    },
    update(s) {
      const c = s.ctl;
      c.dips.forEach((dp, i) => {
        if (typeof dp !== 'object') return;
        const on = ((s.ui && s.ui[dp.p]) ?? dp.def ?? 0) > 0.5;
        setA(s.k[i], 'y', on ? 2 : 5.2);
        setA(s.k[i], 'fill', on ? '#ffffff' : '#f6f2ea');
      });
    },
    pointer(s, nv, type, pt) {
      if (type !== 'down') return;
      const dp = s.ctl.dips[Math.floor(pt.x / s.sw)];
      if (!dp || typeof dp !== 'object') return;
      const cur = ((s.ui && s.ui[dp.p]) ?? dp.def ?? 0) > 0.5 ? 1 : 0;
      tz.app.setParam(nv.block.id, dp.p, 1 - cur);
      if (s.ui) s.ui[dp.p] = 1 - cur;
      this.update(s);
      tz.ui.toast(`${dp.l}: ${cur ? 'off' : 'on'}`, 'info', 900);
    },
  });

  // arcade-style mode button with one LED per position (desktop units)
  tz.addScreen('chase-cycle', {
    build(s, g, w, h) {
      const c = s.ctl, n = c.opts.length;
      s.leds = [];
      c.opts.forEach((o, i) => {
        const x = n === 1 ? w / 2 : 4 + ((w - 8) * i) / (n - 1);
        s.leds.push(svg('circle', { cx: x, cy: 3.5, r: 1.8, fill: '#3a1210', stroke: '#000', 'stroke-width': 0.3 }, g));
        svg('text', { x, y: 8.6, fill: c.ink || '#222', 'font-family': "'Barlow Condensed', sans-serif", 'font-weight': 700, 'font-size': 3.6, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'pointer-events': 'none' }, g, o);
      });
      const cy = h - 10.5;
      svg('circle', { cx: w / 2, cy: cy + 0.8, r: 9.2, fill: '#000', 'fill-opacity': 0.35 }, g);
      svg('circle', { cx: w / 2, cy, r: 9, fill: 'url(#g-chrome)', stroke: '#2a2d31', 'stroke-width': 0.4 }, g);
      svg('circle', { cx: w / 2, cy, r: 6.6, fill: c.cap || '#e7e2d6', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.4 }, g);
      svg('ellipse', { cx: w / 2 - 1.8, cy: cy - 2.2, rx: 3.2, ry: 1.8, fill: '#fff', 'fill-opacity': 0.35 }, g);
      svg('rect', { width: w, height: h, fill: 'transparent' }, g);
    },
    update(s) {
      const c = s.ctl, v = ((s.ui && s.ui[c.param]) ?? c.def ?? 0) | 0;
      s.leds.forEach((l, i) => setA(l, 'fill', i === v ? c.led || '#ff4a2a' : '#3a1210'));
    },
    pointer(s, nv, type) {
      if (type !== 'down') return;
      const c = s.ctl, cur = ((s.ui && s.ui[c.param]) ?? c.def ?? 0) | 0, nx = (cur + 1) % c.opts.length;
      tz.app.setParam(nv.block.id, c.param, nx);
      if (s.ui) s.ui[c.param] = nx;
      this.update(s);
    },
  });

  tz.addScreen('chase-lcd', {
    build(s, g, w, h) {
      svg('rect', { width: w, height: h, rx: 2, fill: '#120d08' }, g);
      const f = "'Share Tech Mono', monospace";
      s.a = svg('text', { x: 5, y: h * 0.36, fill: '#ffb347', 'font-family': f, 'font-size': h * 0.36, 'dominant-baseline': 'central', 'letter-spacing': 1 }, g, '');
      s.b = svg('text', { x: 5, y: h * 0.76, fill: '#c98a3a', 'font-family': f, 'font-size': h * 0.24, 'dominant-baseline': 'central', 'letter-spacing': 0.6 }, g, '');
    },
    update(s, st, nv) {
      const c = s.ctl, u = s.ui || {};
      const t = c.text ? c.text(u, nv && nv.block) : ['', ''];
      if (s._a !== t[0]) { s.a.textContent = t[0]; s._a = t[0]; }
      if (s._b !== t[1]) { s.b.textContent = t[1]; s._b = t[1]; }
    },
  });

  // ------------------------------------------------------------------ printed art (a few dozen paths each)
  function grad(defs, id, stops, x2 = 0, y2 = 1) {
    const lg = svg('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, defs);
    stops.forEach((c, i) => svg('stop', { offset: i / Math.max(1, stops.length - 1), 'stop-color': c }, lg));
    return `url(#${id})`;
  }
  function rgrad(defs, id, stops) {
    const rg = svg('radialGradient', { id, cx: 0.5, cy: 0.5, r: 0.5 }, defs);
    stops.forEach((c, i) => svg('stop', { offset: i / Math.max(1, stops.length - 1), 'stop-color': c }, rg));
    return `url(#${id})`;
  }
  const P = (d) => d.palette || ['#444', '#888', '#ccc', '#fff', '#000'];
  const ART = {
    // planet with orbit rings (tremolo / gravity)
    orbit(g, defs, id, w, h, d) {
      const p = P(d), cx = w * 0.5, cy = h * 0.66;
      for (let i = 0; i < 4; i++) svg('ellipse', { cx, cy, rx: 30 + i * 13, ry: 9 + i * 4.5, fill: 'none', stroke: p[1], 'stroke-width': 0.9, 'stroke-opacity': 0.75 - i * 0.12, transform: `rotate(-14 ${cx} ${cy})` }, g);
      svg('circle', { cx, cy, r: 20, fill: rgrad(defs, id + 'pl', [p[2], shade(p[2], -0.35)]) }, g);
      svg('path', { d: `M${cx - 20} ${cy} A20 20 0 0 0 ${cx + 20} ${cy} A20 7 0 0 1 ${cx - 20} ${cy}`, fill: '#000', 'fill-opacity': 0.18 }, g);
      svg('circle', { cx: cx + 46, cy: cy - 18, r: 4.5, fill: p[3] }, g);
      svg('circle', { cx: cx - 52, cy: cy + 12, r: 2.6, fill: p[4] }, g);
      for (let i = 0; i < 9; i++) svg('circle', { cx: (hash(id + i) % 1000) / 1000 * w, cy: h * 0.48 + ((hash(i + id) >> 4) % 100) / 100 * h * 0.4, r: 0.8, fill: p[4] }, g);
    },
    // Roman bath: columns, pool, rising steam
    steam(g, defs, id, w, h, d) {
      const p = P(d), y0 = h * 0.6;
      svg('rect', { x: 0, y: y0 + 22, width: w, height: h - y0 - 22, fill: grad(defs, id + 'pool', [p[1], p[0]]) }, g);
      for (let i = 0; i < 4; i++) svg('path', { d: `M0 ${y0 + 28 + i * 9} q${w / 8} -3 ${w / 4} 0 t${w / 4} 0 t${w / 4} 0 t${w / 4} 0`, fill: 'none', stroke: p[3], 'stroke-width': 0.8, 'stroke-opacity': 0.55 }, g);
      [0.12, 0.88].forEach((fx) => {
        const x = w * fx;
        svg('rect', { x: x - 6, y: y0 - 20, width: 12, height: 42, fill: p[2] }, g);
        for (let k = -4; k <= 4; k += 2.6) svg('line', { x1: x + k, x2: x + k, y1: y0 - 18, y2: y0 + 20, stroke: shade(p[2], -0.25), 'stroke-width': 0.7 }, g);
        svg('rect', { x: x - 8, y: y0 - 24, width: 16, height: 4, fill: p[2] }, g);
      });
      for (let i = 0; i < 5; i++) {
        const x = w * (0.28 + i * 0.11);
        svg('path', { d: `M${x} ${y0 + 18} c-6 -8 6 -14 0 -22 s6 -14 0 -22`, fill: 'none', stroke: p[3], 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-opacity': 0.7 }, g);
      }
    },
    // crescent moon, stars, soft horizon
    moon(g, defs, id, w, h, d) {
      const p = P(d), cx = w * 0.66, cy = h * 0.6;
      svg('circle', { cx, cy, r: 26, fill: p[2], 'fill-opacity': 0.18 }, g);
      svg('path', { d: `M${cx} ${cy - 20} a20 20 0 1 0 0 40 a15 20 0 1 1 0 -40z`, fill: p[3] }, g);
      for (let i = 0; i < 4; i++) svg('circle', { cx: w * 0.12 + i * 16, cy: cy - 10 + (i % 2) * 14, r: 3.4 - i * 0.4, fill: 'none', stroke: p[3], 'stroke-width': 0.8 }, g);
      const r = rng(hash(id));
      for (let i = 0; i < 14; i++) svg('circle', { cx: r() * w, cy: h * 0.48 + r() * h * 0.22, r: 0.5 + r() * 0.8, fill: p[3] }, g);
      svg('path', { d: `M0 ${h * 0.84} Q${w * 0.3} ${h * 0.74} ${w * 0.55} ${h * 0.82} T${w} ${h * 0.78} V${h} H0z`, fill: p[1] }, g);
      svg('path', { d: `M0 ${h * 0.9} Q${w * 0.4} ${h * 0.82} ${w} ${h * 0.9} V${h} H0z`, fill: p[0] }, g);
    },
    // jagged storm cloud, lightning, slanted rain
    storm(g, defs, id, w, h, d) {
      const p = P(d), y = h * 0.56;
      svg('rect', { x: 0, y: h * 0.5, width: w, height: h * 0.5, fill: grad(defs, id + 's', [p[0], p[1]]) }, g);
      svg('path', { d: `M${w * 0.14} ${y + 14} q-8 -14 8 -16 q2 -14 18 -10 q8 -12 24 -4 q14 -6 20 8 q14 0 10 14 q8 10 -6 12 h-68 q-12 -2 -6 -4z`, fill: p[2] }, g);
      svg('path', { d: `M${w * 0.5} ${y + 22} l-9 18 h7 l-6 18 l15 -24 h-7 l6 -12z`, fill: p[3] }, g);
      for (let i = 0; i < 10; i++) svg('line', { x1: w * 0.12 + i * 11, y1: y + 30 + (i % 3) * 5, x2: w * 0.12 + i * 11 - 5, y2: y + 42 + (i % 3) * 5, stroke: p[4], 'stroke-width': 0.9, 'stroke-linecap': 'round', 'stroke-opacity': 0.8 }, g);
    },
    // overlapping soap bubbles
    bubbles(g, defs, id, w, h, d) {
      const p = P(d), r = rng(hash(id + 'b'));
      for (let i = 0; i < 15; i++) {
        const rr = 4 + r() * 14, x = r() * w, y = h * 0.5 + r() * h * 0.4, col = p[i % 5];
        svg('circle', { cx: x, cy: y, r: rr, fill: col, 'fill-opacity': 0.8, stroke: shade(col, -0.35), 'stroke-width': 0.6 }, g);
        svg('circle', { cx: x - rr * 0.35, cy: y - rr * 0.35, r: rr * 0.25, fill: '#fff', 'fill-opacity': 0.55 }, g);
      }
    },
    // two mirrored figures facing each other
    twins(g, defs, id, w, h, d) {
      const p = P(d), y = h * 0.52;
      svg('rect', { x: 0, y, width: w / 2, height: h - y, fill: p[0] }, g);
      svg('rect', { x: w / 2, y, width: w / 2, height: h - y, fill: p[1] }, g);
      const face = `c-10 0 -18 8 -18 20 c0 6 -4 8 -6 12 l6 2 c-1 4 0 8 4 9 c-2 4 2 7 8 6 c4 4 6 10 6 16`;
      svg('path', { d: `M${w / 2 - 4} ${y + 6} ${face} H${w / 2 - 4}z`, fill: p[2] }, g);
      svg('path', { d: `M${w / 2 - 4} ${y + 6} ${face} H${w / 2 - 4}z`, fill: p[3], transform: `translate(${w},0) scale(-1,1)` }, g);
      svg('circle', { cx: w / 2 - 18, cy: y + 22, r: 1.6, fill: p[4] }, g);
      svg('circle', { cx: w / 2 + 18, cy: y + 22, r: 1.6, fill: p[4] }, g);
    },
    // sunburst rays and broadcast arcs
    radio(g, defs, id, w, h, d) {
      const p = P(d), cx = w / 2, cy = h * 0.82;
      for (let i = 0; i < 12; i++) {
        const a0 = Math.PI + (i / 12) * Math.PI, a1 = a0 + Math.PI / 24;
        svg('path', { d: `M${cx} ${cy} L${cx + Math.cos(a0) * 130} ${cy + Math.sin(a0) * 130} L${cx + Math.cos(a1) * 130} ${cy + Math.sin(a1) * 130}z`, fill: i % 2 ? p[0] : p[1], 'fill-opacity': 0.55 }, g);
      }
      for (let i = 1; i <= 3; i++) svg('path', { d: `M${cx - i * 14} ${cy} A${i * 14} ${i * 14} 0 0 1 ${cx + i * 14} ${cy}`, fill: 'none', stroke: p[2], 'stroke-width': 1.6 }, g);
      svg('circle', { cx, cy, r: 6, fill: p[3] }, g);
    },
    // decaying codec blocks
    pixels(g, defs, id, w, h, d) {
      const p = P(d), r = rng(hash(id + 'px')), s = 9;
      for (let y = h * 0.5; y < h; y += s)
        for (let x = 0; x < w; x += s) {
          const t = (y - h * 0.5) / (h * 0.5);
          if (r() > 0.25 + t * 0.6) continue;
          svg('rect', { x: x + 0.6, y: y + 0.6, width: s - 1.2, height: s - 1.2, fill: p[Math.floor(r() * 4)], 'fill-opacity': 0.85 - t * 0.3 }, g);
        }
    },
    // VHS tracking stripes
    vhs(g, defs, id, w, h, d) {
      const p = P(d);
      for (let i = 0; i < 5; i++) svg('path', { d: `M${-20 + i * 9} ${h} L${w * 0.55 + i * 9} ${h * 0.46} h9 L${-11 + i * 9} ${h}z`, fill: p[i] }, g);
      const r = rng(hash(id));
      for (let i = 0; i < 8; i++) { const y = h * 0.5 + r() * h * 0.45; svg('rect', { x: r() * w * 0.6, y, width: 20 + r() * 40, height: 0.9, fill: '#fff', 'fill-opacity': 0.35 }, g); }
    },
    // forward chevrons
    arrows(g, defs, id, w, h, d) {
      const p = P(d);
      for (let i = 0; i < 5; i++) {
        const x = 8 + i * 24, y = h * 0.6 + (i % 2) * 8;
        svg('path', { d: `M${x} ${y} l14 14 l-14 14 h-8 l14 -14 l-14 -14z`, fill: p[i % 4] }, g);
      }
      svg('path', { d: `M0 ${h * 0.86} H${w}`, stroke: p[2], 'stroke-width': 1, 'stroke-dasharray': '3 3' }, g);
    },
    // additive RGB circles
    rgb(g, defs, id, w, h, d) {
      const cx = w / 2, cy = h * 0.63, r = 19;
      [['#e5322d', 0, -9], ['#2fb24a', -10, 7], ['#2d62e0', 10, 7]].forEach(([c, dx, dy]) => svg('circle', { cx: cx + dx, cy: cy + dy, r, fill: c, 'fill-opacity': 0.62 }, g));
      svg('circle', { cx, cy: cy + 1.5, r: 5, fill: '#fff', 'fill-opacity': 0.85 }, g);
    },
    // scattered found objects
    objects(g, defs, id, w, h, d) {
      const p = P(d), y = h * 0.52;
      svg('path', { d: `M14 ${y + 22} a6 6 0 1 1 6 6 h16 v4 h-3 v3 h-3 v-3 h-10z`, fill: p[0] }, g);
      svg('path', { d: `M${w - 30} ${y + 8} l4 9 l10 1 l-7 7 l2 10 l-9 -5 l-9 5 l2 -10 l-7 -7 l10 -1z`, fill: p[1] }, g);
      svg('circle', { cx: w * 0.45, cy: y + 48, r: 9, fill: 'none', stroke: p[2], 'stroke-width': 2.2 }, g);
      svg('path', { d: `M${w * 0.22} ${y + 62} l12 -20 l12 20z`, fill: p[3] }, g);
      svg('rect', { x: w * 0.68, y: y + 46, width: 16, height: 11, rx: 2, fill: p[4], transform: `rotate(18 ${w * 0.68 + 8} ${y + 52})` }, g);
      svg('path', { d: `M${w * 0.4} ${y + 12} q8 -10 16 0 t16 0`, fill: 'none', stroke: p[0], 'stroke-width': 1.6 }, g);
    },
    // mirrored arcs (forward / reverse)
    mirror(g, defs, id, w, h, d) {
      const p = P(d), cx = w / 2, cy = h * 0.65;
      for (let i = 1; i <= 5; i++) {
        svg('path', { d: `M${cx - 3} ${cy - i * 6} A${i * 6} ${i * 6} 0 0 0 ${cx - 3} ${cy + i * 6}`, fill: 'none', stroke: p[0], 'stroke-width': 1.5, 'stroke-opacity': 1 - i * 0.12 }, g);
        svg('path', { d: `M${cx + 3} ${cy - i * 6} A${i * 6} ${i * 6} 0 0 1 ${cx + 3} ${cy + i * 6}`, fill: 'none', stroke: p[1], 'stroke-width': 1.5, 'stroke-opacity': 1 - i * 0.12 }, g);
      }
      svg('path', { d: `M${cx - 44} ${cy + 40} h30 m-30 0 l6 -4 m-6 4 l6 4`, stroke: p[2], 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }, g);
      svg('path', { d: `M${cx + 14} ${cy + 40} h30 m0 0 l-6 -4 m6 4 l-6 4`, stroke: p[2], 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }, g);
    },
    // fanned wing feathers
    wing(g, defs, id, w, h, d) {
      const p = P(d), ox = w * 0.12, oy = h * 0.88;
      for (let i = 0; i < 9; i++) {
        const a = (-80 + i * 9) * Math.PI / 180, L = 80 - i * 4;
        const x = ox + Math.cos(a) * L, y = oy + Math.sin(a) * L;
        svg('path', { d: `M${ox} ${oy} Q${(ox + x) / 2 + 6} ${(oy + y) / 2 - 2} ${x} ${y} Q${(ox + x) / 2 - 2} ${(oy + y) / 2 + 6} ${ox} ${oy}z`, fill: p[i % 3], stroke: p[3], 'stroke-width': 0.5 }, g);
      }
      svg('circle', { cx: w * 0.78, cy: h * 0.62, r: 10, fill: p[4] }, g);
    },
    // memory spiral
    spiral(g, defs, id, w, h, d) {
      const p = P(d), cx = w / 2, cy = h * 0.66;
      let path = `M${cx} ${cy}`;
      for (let t = 0; t < 6 * Math.PI; t += 0.35) path += ` L${(cx + Math.cos(t) * t * 2.1).toFixed(1)} ${(cy + Math.sin(t) * t * 2.1).toFixed(1)}`;
      svg('path', { d: path, fill: 'none', stroke: p[2], 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
      for (let i = 0; i < 6; i++) svg('circle', { cx: cx + Math.cos(i * 1.1) * (14 + i * 6), cy: cy + Math.sin(i * 1.1) * (14 + i * 6), r: 2.2, fill: p[i % 2 ? 3 : 4] }, g);
    },
    // concentric organic rings
    womb(g, defs, id, w, h, d) {
      const p = P(d), cx = w / 2, cy = h * 0.66;
      for (let i = 5; i >= 1; i--) {
        let path = '';
        for (let k = 0; k <= 24; k++) {
          const a = (k / 24) * Math.PI * 2, rr = i * 8 + Math.sin(a * 3 + i) * 2.4;
          path += (k ? ' L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr * 0.9).toFixed(1);
        }
        svg('path', { d: path + 'z', fill: p[i % 5] }, g);
      }
    },
    // psychedelic swirl with stars (signature phaser)
    psyche(g, defs, id, w, h, d) {
      const p = P(d), cx = w / 2, cy = h * 0.66;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        svg('path', { d: `M${cx} ${cy} Q${cx + Math.cos(a + 0.6) * 40} ${cy + Math.sin(a + 0.6) * 34} ${cx + Math.cos(a) * 64} ${cy + Math.sin(a) * 52} Q${cx + Math.cos(a + 0.2) * 30} ${cy + Math.sin(a + 0.2) * 24} ${cx} ${cy}z`, fill: p[i % 4] }, g);
      }
      svg('circle', { cx, cy, r: 7, fill: p[4] }, g);
      [[0.14, 0.52], [0.86, 0.56], [0.2, 0.9], [0.82, 0.9]].forEach(([fx, fy]) => { const x = w * fx, y = h * fy; svg('path', { d: `M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2}z`, fill: p[3] }, g); });
    },
    // ghostly prism splitting a spectrum
    prism(g, defs, id, w, h, d) {
      const cx = w * 0.4, cy = h * 0.66, cols = ['#ff4b4b', '#ff9d2e', '#ffe14a', '#4fdc6a', '#3fa8ff', '#9a6bff'];
      cols.forEach((c, i) => svg('path', { d: `M${cx + 8} ${cy} L${w + 2} ${cy - 22 + i * 8} L${w + 2} ${cy - 15 + i * 8}z`, fill: c, 'fill-opacity': 0.85 }, g));
      svg('path', { d: `M0 ${cy + 2} L${cx - 4} ${cy}`, stroke: '#fff', 'stroke-width': 1.6 }, g);
      svg('path', { d: `M${cx} ${cy - 22} L${cx + 20} ${cy + 14} H${cx - 20}z`, fill: '#fff', 'fill-opacity': 0.25, stroke: '#fff', 'stroke-width': 1 }, g);
    },
    // warped record
    vinyl(g, defs, id, w, h, d) {
      const p = P(d), cx = w / 2, cy = h * 0.66;
      svg('path', { d: `M${cx - 40} ${cy} C${cx - 40} ${cy - 30} ${cx + 40} ${cy - 36} ${cx + 42} ${cy - 2} C${cx + 44} ${cy + 30} ${cx - 38} ${cy + 34} ${cx - 40} ${cy}z`, fill: p[0] }, g);
      for (let i = 1; i <= 4; i++) svg('ellipse', { cx, cy, rx: 38 - i * 6, ry: 28 - i * 4.5, fill: 'none', stroke: p[1], 'stroke-width': 0.6, transform: `rotate(${-6 + i * 2} ${cx} ${cy})` }, g);
      svg('ellipse', { cx, cy, rx: 11, ry: 8.5, fill: p[2] }, g);
      svg('circle', { cx, cy, r: 1.3, fill: p[3] }, g);
      svg('path', { d: `M${cx - 30} ${cy - 16} q10 -8 22 -8`, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.4, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g);
    },
  };

  // ------------------------------------------------------------------ enclosure: printed portrait box
  const SIZES = { std: [132, 262], mk2: [146, 268], rmc: [166, 268], tall: [150, 300] };
  let seq = 0;
  const mine = new WeakSet(); // controls this form placed (forms re-run on every redraw)
  tz.addForm('chase', (ctx, d) => {
    const g = ctx.g, [w, h] = SIZES[d.size || 'std'];
    const id = 'cb' + ++seq;
    const defs = svg('defs', {}, g);
    const text = d.text || '#111';
    formKit.body(g, w, h, d.color, { rx: 6, grain: false });
    d.controls.forEach((c) => { if (c.x === undefined || mine.has(c)) mine.add(c); });
    const free = (t) => d.controls.filter((c) => c.t === t && !c.hidden && mine.has(c));
    // vertical plan: jack labels | DIP bank | knob rows | toggle rows | art + logo | LEDs | footswitches
    const rows = d.rows || [3, 3];
    const kr = d.kr || 10.5, ky = [58, 102];
    const togs = free('toggle').filter((t) => t.role !== 'preset');
    const tcols = d.togCols || 3, trows = Math.ceil(togs.length / tcols);
    const ty = 150, togBottom = ty + (trows - 1) * 36 + 16;
    const fy = h - 30, ledY = fy - 22;
    const artTop = togBottom + 4;
    // printed art: everything below the controls, shifted so each motif sits in the free band
    const ag = svg('g', {}, g);
    const clipId = id + 'clip';
    const cp = svg('clipPath', { id: clipId }, defs);
    svg('rect', { x: 0, y: artTop, width: w, height: h - artTop, rx: 6 }, cp);
    ag.setAttribute('clip-path', `url(#${clipId})`);
    const ai = svg('g', { transform: `translate(0 ${(artTop - h * 0.5 + 14).toFixed(1)})` }, ag);
    if (d.art && ART[d.art]) ART[d.art](ai, defs, id, w, h, d);
    svg('line', { x1: 8, x2: w - 8, y1: artTop, y2: artTop, stroke: text, 'stroke-opacity': 0.25, 'stroke-width': 0.6 }, g);
    svg('rect', { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 5.5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.2, 'stroke-width': 1.1 }, g);
    svg('rect', { width: w, height: h, rx: 6, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, g);

    const colX = (n, i) => { const m = n >= 4 ? 21 : 24; return n === 1 ? w / 2 : m + ((w - 2 * m) * i) / (n - 1); };
    const knobs = free('knob');
    let ki = 0;
    rows.forEach((n, ri) => {
      for (let i = 0; i < n && ki < knobs.length; i++, ki++) {
        const k = knobs[ki];
        Object.assign(k, { x: colX(n, i), y: ky[ri], r: kr, labelPos: 'none' });
        label(g, k.x, k.y + kr + 7.2, k.label, { size: d.labelSize || 5.2, fill: text, font: "'Barlow Condensed', sans-serif", weight: 700, ls: 0.5 });
      }
    });
    togs.forEach((t, i) => {
      const row = Math.floor(i / tcols), col = t.col ?? i % tcols;
      Object.assign(t, { x: colX(tcols, col) - 4, y: ty + row * 36, orient: 'v', optSize: 4.4 });
      if (t.label) label(g, t.x + 4, t.y - 17, t.label, { size: 4.4, fill: text, font: "'Barlow Condensed', sans-serif", weight: 700, ls: 0.4 });
    });
    const pre = d.controls.find((t) => t.role === 'preset');
    if (pre && mine.has(pre)) Object.assign(pre, { x: w / 2, y: fy - 4, orient: 'h', optSize: 4 });
    // logo on a printed plate in the middle of the art band
    const ls = d.logoSize || 13, logo = d.logo || d.name;
    const ly = (artTop + ledY) / 2 - 5;
    const tw = Math.min(w - 16, Math.max(logo.length * ls * 0.6 + logo.length * (d.logoLs ?? 1.5) + 14, (d.typeName || '').length * 3.3 + 14));
    svg('rect', { x: (w - tw) / 2, y: ly - ls * 0.72, width: tw, height: ls * 1.44 + 9, rx: 3, fill: d.plate || d.color, stroke: text, 'stroke-opacity': 0.35, 'stroke-width': 0.6 }, g);
    label(g, w / 2, ly, logo, { size: ls, fill: d.logoColor || text, font: d.logoFont || "'Oswald', sans-serif", weight: d.logoWeight || 600, ls: d.logoLs ?? 1.5 });
    if (d.typeName) label(g, w / 2, ly + ls * 0.62 + 3.2, d.typeName.toUpperCase(), { size: 3.8, fill: d.logoColor || text, font: "'Inter', sans-serif", weight: 600, ls: 0.9 });
    // modifier buttons sit on small plates beside the logo
    free('button').forEach((b, i, arr) => {
      Object.assign(b, { x: arr.length === 1 ? w / 2 : i ? w - 13 : 13, y: ly + 2, r: 4.2, labelSize: 4.4, ledDy: -8 });
      svg('rect', { x: b.x - 9, y: ly - 11, width: 18, height: 26, rx: 3, fill: d.plate || d.color, stroke: text, 'stroke-opacity': 0.35, 'stroke-width': 0.6 }, g);
    });
    const feet = free('foot');
    feet.forEach((f, i) => Object.assign(f, { style: 'stomp', r: 10.5, x: feet.length === 1 ? w / 2 : w * [0.24, 0.76][i], y: fy, labelDy: 17.5, labelSize: 4.6 }));
    // small printed plates behind the footswitch captions keep them readable over the art
    feet.forEach((f) => { if (!f.label) return; const lw = f.label.length * 2.75 + 7; svg('rect', { x: f.x - lw / 2, y: fy + 13.3, width: lw, height: 8.4, rx: 2, fill: d.plate || d.color, stroke: text, 'stroke-opacity': 0.3, 'stroke-width': 0.5 }, g); });
    if (pre && mine.has(pre)) svg('rect', { x: w / 2 - 20, y: fy - 16, width: 40, height: 33, rx: 4, fill: d.plate || d.color, stroke: text, 'stroke-opacity': 0.3, 'stroke-width': 0.5 }, g);
    const leds = free('led');
    leds.forEach((l, i) => Object.assign(l, { r: 2.4, x: leds.length === 1 ? w / 2 : leds.length === 2 ? w * [0.24, 0.76][i] : w * [0.24, 0.5, 0.76][i], y: ledY }));
    const dip = d.controls.find((c) => c.t === 'screen' && c.kind === 'chase-dips');
    if (dip && mine.has(dip)) Object.assign(dip, { x: w / 2, y: 26, w: w - 22, h: 18, bg: 'transparent', bezel: 'transparent', ink: d.dipInk || text });
    svg('rect', { x: w / 2 - 16, y: h - 8.2, width: 32, height: 7, rx: 2, fill: d.plate || d.color }, g);
    formKit.tzBadge(g, w / 2, h - 4.5, text, 3.4);
    const theme = { text, knob: d.knob || 'mxr', labelSize: 5.2, toggleTitles: false, jackText: text };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  // ------------------------------------------------------------------ enclosure: motorised-fader desktop box
  tz.addForm('chase-desk', (ctx, d) => {
    const g = ctx.g, w = d.deskW || 236, h = d.deskH || 258;
    const id = 'cbd' + ++seq;
    const defs = svg('defs', {}, g);
    const text = d.text || '#1c1a17';
    formKit.body(g, w, h, d.side || '#2b2622', { rx: 7, grain: false });
    svg('rect', { x: 9, y: 0, width: w - 18, height: h, fill: d.color }, g);
    svg('rect', { x: 9, y: 0, width: w - 18, height: h, fill: grad(defs, id + 'sh', ['#ffffff', '#000000'], 0, 1), 'fill-opacity': 0.06 }, g);
    for (const x of [0, w - 9]) for (let k = 1; k < 6; k++) svg('line', { x1: x + 1, x2: x + 8, y1: (h * k) / 6, y2: (h * k) / 6 + 3, stroke: '#000', 'stroke-opacity': 0.25, 'stroke-width': 0.6 }, g);
    if (d.stripe) svg('rect', { x: 9, y: 53, width: w - 18, height: 3, fill: d.stripe }, g);
    label(g, 20, 31, d.logo, { size: d.logoSize || 15, fill: d.logoColor || text, font: d.logoFont || "'Oswald', sans-serif", weight: 600, ls: 2, anchor: 'start' });
    label(g, 21, 45, (d.typeName || '').toUpperCase(), { size: 4.5, fill: text, font: "'Inter', sans-serif", weight: 600, ls: 1.2, anchor: 'start' });
    d.controls.forEach((c) => { if (c.x === undefined || mine.has(c)) mine.add(c); });
    const free = (t) => d.controls.filter((c) => c.t === t && !c.hidden && mine.has(c));
    const lcd = free('screen').find((c) => c.kind === 'chase-lcd');
    if (lcd) Object.assign(lcd, { x: w - 52, y: 34, w: 70, h: 22, bezel: '#0a0806' });
    const cyc = free('screen').filter((c) => c.kind === 'chase-cycle');
    cyc.forEach((c, i) => {
      const n = cyc.length, x = 34 + ((w - 68) * i) / Math.max(1, n - 1);
      Object.assign(c, { x, y: 82, w: 32, h: 30, bg: 'transparent', bezel: 'transparent', ink: text, interactive: true });
      label(g, x, 103, c.label, { size: 4.8, fill: text, font: "'Barlow Condensed', sans-serif", weight: 700, ls: 0.6 });
    });
    const sl = free('slider');
    sl.forEach((s, i) => {
      const n = sl.length, x = 30 + ((w - 60) * i) / Math.max(1, n - 1);
      Object.assign(s, { x, y: 150, h: 58, w: 9, capColor: d.cap || '#1b1b1b', lineColor: d.capLine || '#ffb347', labelSize: 5 });
    });
    const feet = free('foot');
    feet.forEach((f, i) => Object.assign(f, { style: 'stomp', r: 11, x: w * [0.25, 0.75][i], y: h - 32, labelDy: 18, labelSize: 4.8 }));
    free('led').forEach((l, i) => Object.assign(l, { r: 2.6, x: w * [0.25, 0.75][i], y: h - 56 }));
    formKit.tzBadge(g, w / 2, h - 7, text, 3.6);
    const theme = { text, knob: 'mxr', labelSize: 5, toggleTitles: false, jackText: text };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  // ------------------------------------------------------------------ block builder
  // o.presets: [presetA, presetB] UI overrides recalled by the little A / LIVE / B toggle (knobs keep showing the
  // live settings, like the real pedals). o.dips: DIP bank labels; {p, l} entries are working switches.
  const CB = (o) => {
    const d = def(Object.assign({ form: 'chase', brand: 'Chase Bliss', cost: 1, stereo: 'both', ports: MONO, monoPorts: MONO, stereoPorts: STEREO }, o));
    if (o.dips) {
      d.controls.push(SCREEN('chase-dips', { dips: o.dips, interactive: true }));
      o.dips.forEach((dp) => { if (typeof dp === 'object') d.controls.push(TOG(dp.p, dp.l, ['off', 'on'], { def: dp.def || 0, virtual: true, hidden: true })); });
    }
    if (o.presets) {
      d.controls.push(TOG('scene', 'PRESET', ['A', 'LIVE', 'B'], { def: 1, virtual: true, role: 'preset' }));
      const base = o.derive;
      d.derive = (ui) => {
        const sc = Math.round(ui.scene ?? 1);
        const u = sc === 1 ? ui : Object.assign({}, ui, o.presets[sc === 0 ? 0 : 1]);
        const out = {};
        if (u !== ui)
          for (const c of d.controls) {
            if (!c.p || c.virtual || u[c.p] === undefined) continue;
            let v = u[c.p];
            if (c.t === 'sel' || c.t === 'toggle') v = c.values ? c.values[v | 0] ?? c.values[0] : v | 0;
            else if (c.t === 'button' && c.toggle) v = v ? 1 : 0;
            out[c.p] = v;
          }
        return Object.assign(out, base ? base(u) : {});
      };
    }
    hookFeet(d);
    return d;
  };
  const WAVE_L = ['SIN', 'TRI', 'SQR'], WAVE_R = ['SQR', 'TRI', 'SIN'];
  const squareness = (ui) => ([0, 0.35, 1][ui.wl ?? 1] + [1, 0.35, 0][ui.wr ?? 1]) / 2;
  const bypassLed = (o = {}) => LED(Object.assign({ color: '#ff3324' }, o));
  const RAMP_DIPS = ['BOUNCE', 'SWEEP', 'TAP R/P', 'DIV 3'];

  const defs = [];
  const add = (...d) => defs.push(...d);

  // ================================================================== classic analog line (125B, back-panel DIPs)
  add(CB({
    id: 'cba.gravitas', name: 'Pondus', ref: 'Chase Bliss Gravitas', code: 'PONDUS', logo: 'PONDUS', logoFont: "'Oswald', sans-serif", logoLs: 4,
    typeName: 'Analog tremolo', cat: 'Modulation', art: 'orbit', color: '#8d939a', text: '#15171a', palette: ['#6e757d', '#e9e6dc', '#e8a83a', '#2a2e34', '#f4f1e8'],
    algo: 'chain', cost: 0.8,
    opts: { chain: [{ prefix: 'b', algo: 'boost', params: { mode: 0 } }, { prefix: 't', algo: 'tremolo' }, { prefix: 'eq', algo: 'peq' }] },
    controls: [
      K('drive', 'DRIVE', { def: 0.2, virtual: true }), K('vol', 'VOLUME', { def: 0.75, virtual: true }), K('tone', 'TONE', { def: 0.5, virtual: true }),
      K('t.rate', 'RATE', { def: 0.42 }), K('t.depth', 'DEPTH', { def: 0.6 }), K('sway', 'SWAY', { def: 0.5, virtual: true }),
      TOG('div', '1 · 2 · 4', ['1', '2', '4'], { virtual: true }), TOG('wl', 'WAVE', WAVE_L, { virtual: true, def: 0 }), TOG('wr', 'WAVE', WAVE_R, { virtual: true, def: 2 }),
      FOOT({ label: 'TAP', cb: { tap: (c) => tapRate(c, 't.rate', 0.4, 14, [1, 2, 4][c.ui.div | 0]) } }), FOOT({ label: 'BYPASS', cb: { tap: 'bypass' } }),
      LED({ bind: 'rate:on:t.rate', color: '#ffb02e' }), bypassLed(),
    ],
    dips: [{ p: 'mdip', l: 'MODE' }, { p: 'moto', l: 'MOTOBYP' }, ...RAMP_DIPS, 'RATE', 'DEPTH'],
    presets: [{ 't.rate': 0.75, 't.depth': 0.85, wl: 2, wr: 0 }, { 't.rate': 0.25, 't.depth': 0.5, mdip: 1, div: 2 }],
    momentaryWhen: (ui) => ui.moto > 0.5,
    derive: (p) => {
      const tone = p.tone ?? 0.5;
      return {
        'b.gain': (p.drive ?? 0.2) * 0.7, 'b.level': 0.45 + 0.55 * (p.vol ?? 0.75),
        't.mode': p.mdip ? [0, 2, 1][p.div | 0] : 0,
        't.wave': c01(squareness(p) + Math.abs((p.sway ?? 0.5) - 0.5) * 0.3),
        'eq.lowfreq': 180, 'eq.lowgain': (0.5 - tone) * 10, 'eq.highfreq': 3200, 'eq.highgain': (tone - 0.5) * 12,
      };
    },
    desc: 'Analog tremolo with a clean boost in front (DRIVE + VOLUME) and a tilt TONE. Two wave-shape toggles build the LFO; tap the left switch for tempo (1/2/4 divisions). DIP MODE turns the 1·2·4 toggle into Standard / Both / Harmonic, MOTOBYP makes bypass momentary.',
  }));

  add(CB({
    id: 'cba.thermae', name: 'Caldarium', ref: 'Chase Bliss Thermae', code: 'CALDARIUM', logo: 'Caldarium', logoFont: "'Dancing Script', cursive", logoSize: 17, logoLs: 0.5,
    typeName: 'Analog pitch-step delay', cat: 'Delay', art: 'steam', color: '#2f6db0', text: '#f3f7fc', palette: ['#16457c', '#5aa2e0', '#e8e2d2', '#ffffff', '#f2c14e'],
    algo: 'chain', cost: 2.2,
    opts: { chain: [DRY('d', 1), WET('w', 'delay', { group: 1, lvl: 1.4, opts: { maxMs: 2000, defaultMs: 500 }, params: { mode: 1, mix: 0.72, feedback: 0.4, sat: 0.25, age: 0.25 },
      post: [{ prefix: 'p', algo: 'pitch', params: { dry: 0, level1: 0.8, level2: 0, semis1: 12, semis2: 0 } }] })] },
    controls: [
      K('mix', 'MIX', { def: 0.42, virtual: true }), K('w.x.tone', 'LPF', { def: 0.6 }), K('w.x.feedback', 'REGEN', { def: 0.4, max: 1.05 }),
      K('w.p.glide', 'GLIDE', { def: 0.15 }), K('i1', 'INT 1', { def: 0.8, virtual: true, display: semiTxt }), K('i2', 'INT 2', { def: 0.5, virtual: true, display: semiTxt }),
      K('tempo', 'TEMPO', { min: 60, max: 2000, def: 500, virtual: true, hidden: true, display: ms }),
      TOG('s0', 'STEP', ['1/4', '1/8.', '1/8'], { virtual: true }), TOG('s1', 'INT 1', ['1/4', '1/8.', '1/8'], { virtual: true }), TOG('s2', 'INT 2', ['1/4', '1/8.', '1/8'], { virtual: true }),
      FOOT({ label: 'TAP', cb: { tap: (c) => { const dt = c.tapMs(); if (dt) c.set('tempo', dt); }, hold: (c) => c.set('run', 1), release: (c) => c.set('run', 0) } }),
      FOOT({ label: 'BYPASS', cb: { tap: 'bypass' } }),
      LED({ bind: 'tap:w.x.time', color: '#5ad1ff' }), bypassLed(),
      K('run', 'RUNAWAY', { def: 0, virtual: true, hidden: true }),
    ],
    dips: [{ p: 'mod', l: 'MOD' }, { p: 'moto', l: 'MOTOBYP' }, 'STEP', 'TRAILS', 'BOUNCE', 'RAMP', 'SWEEP', 'MIX'],
    presets: [{ i1: 0.65, i2: 0.35, 'w.x.feedback': 0.55 }, { i1: 0.9, i2: 1, 'w.p.glide': 0.6 }],
    momentaryWhen: (ui) => ui.moto > 0.5,
    derive: (p) => {
      const mix = p.mix ?? 0.42, f = [1, 0.75, 0.5];
      const s1 = pick(p.i1 ?? 0.8, SEMIS), s2 = pick(p.i2 ?? 0.5, SEMIS);
      const o = { 'd.lvl': dn(mix), 'w.lvl': up(mix) * 0.7, 'w.x.time': clamp((p.tempo ?? 500) * f[p.s0 | 0], 20, 2000) };
      if (p.run) o['w.x.feedback'] = 1.08;
      if (p.mod) Object.assign(o, { 'w.p.on': 0, 'w.x.moddepth': p.i2 ?? 0.5, 'w.x.modrate': p.i1 ?? 0.8 });
      else Object.assign(o, { 'w.x.moddepth': 0, 'w.p.on': s1 || s2 ? 1 : 0, 'w.p.semis1': s1, 'w.p.semis2': s2,
        'w.p.level1': s1 ? [0.9, 0.75, 0.6][p.s1 | 0] : 0, 'w.p.level2': s2 ? [0.9, 0.75, 0.6][p.s2 | 0] : 0 });
      return o;
    },
    desc: 'Analog-voiced delay whose echoes are pitch-shifted by two interval steps (INT 1 / INT 2: off at noon, 4th, 5th, octave, octave+5th, two octaves up or down) with GLIDE between them. Tempo comes from the TAP switch (hold for runaway regen); the toggles set the base subdivision and the weight of each step. DIP MOD turns the INT knobs into modulation speed / depth.',
  }));

  add(CB({
    id: 'cba.wombtone2', name: 'Cocoon MKII', ref: 'Chase Bliss Wombtone MKII', code: 'COCOON', logo: 'cocoon', logoFont: "'Dancing Script', cursive", logoSize: 19, logoLs: 0.5,
    typeName: 'Analog phaser', cat: 'Modulation', art: 'womb', color: '#f1c7c4', text: '#3b1b29', palette: ['#e98c8f', '#f6dcc8', '#c4517a', '#f2a9a0', '#7d2a4d'],
    algo: 'chain', cost: 0.7,
    opts: { chain: [{ prefix: 'ph', algo: 'phaser', opts: { stages: 4 } }, { prefix: 'v', algo: 'utility' }] },
    controls: [
      K('ph.feedback', 'FEED', { def: 0.45 }), K('vol', 'VOLUME', { def: 0.5, virtual: true }), K('ph.mix', 'MIX', { def: 0.5 }),
      K('ph.rate', 'RATE', { def: 0.4 }), K('ph.depth', 'DEPTH', { def: 0.75 }), K('form', 'FORM', { def: 0.5, virtual: true }),
      TOG('div', '1 · 2 · 4', ['1', '2', '4'], { virtual: true }), TOG('wl', 'WAVE', WAVE_L, { virtual: true, def: 0 }), TOG('wr', 'WAVE', WAVE_R, { virtual: true, def: 2 }),
      FOOT({ label: 'TAP', cb: { tap: (c) => tapRate(c, 'ph.rate', 0.04, 10, c.ui.stg ? 1 : [1, 2, 4][c.ui.div | 0]) } }), FOOT({ label: 'BYPASS', cb: { tap: 'bypass' } }),
      LED({ bind: 'rate:on:ph.rate', color: '#ffb02e' }), bypassLed(),
    ],
    dips: [{ p: 'stg', l: 'STAGES' }, { p: 'moto', l: 'MOTOBYP' }, ...RAMP_DIPS, 'MIX', 'FORM'],
    presets: [{ 'ph.rate': 0.2, 'ph.feedback': 0.75, 'ph.depth': 0.9 }, { 'ph.rate': 0.7, 'ph.mix': 1, 'ph.feedback': 0.3 }],
    momentaryWhen: (ui) => ui.moto > 0.5,
    derive: (p) => ({
      'ph.stages': p.stg ? [2, 4, 6][p.div | 0] : 4,
      'ph.center': c01(0.5 + ((p.form ?? 0.5) - 0.5) * 0.5 + (squareness(p) - 0.5) * 0.1),
      'v.level': ((p.vol ?? 0.5) - 0.5) * 24,
    }),
    desc: 'Four-stage vactrol-style phaser. MIX blends from dry through phase-chorus (noon) to full phase vibrato, FEED adds resonance, FORM moves the sweep centre. Tap tempo with 1/2/4 divisions; DIP STAGES makes the left toggle select 2 / 4 / 6 stages.',
  }));

  add(CB({
    id: 'cba.wombtone-bs', name: 'Cocoon Bluegrass', ref: 'Chase Bliss Billy Strings Wombtone', code: 'COCOON BG', logo: 'cocoon', logoFont: "'Dancing Script', cursive", logoSize: 19, logoLs: 0.5,
    typeName: 'Analog envelo-phaser', cat: 'Modulation', art: 'psyche', size: 'tall', rows: [4, 3], color: '#2c1846', text: '#f6eefc',
    palette: ['#7d3cc9', '#e6457f', '#f4a83a', '#2bb6a6', '#ffe36b'], algo: 'chain', cost: 1,
    opts: { chain: [{ prefix: 'ph', algo: 'phaser', opts: { stages: 6 } }, { prefix: 'e', algo: 'wah', on: false, params: { mode: 2, filter: 0, q: 0.25, range: 0.5, level: 0.5 } }, { prefix: 'v', algo: 'utility' }] },
    controls: [
      K('ph.feedback', 'FEED', { def: 0.45 }), K('vol', 'VOLUME', { def: 0.5, virtual: true }), K('ph.mix', 'MIX', { def: 0.5 }), K('ph.rate', 'RATE', { def: 0.4 }),
      K('shape', 'MODUSHAPE', { def: 0.5, virtual: true }), K('ph.depth', 'DEPTH', { def: 0.75 }), K('form', 'FORM', { def: 0.5, virtual: true }),
      TOG('div', 'STG/TAP', ['1', '2', '4'], { virtual: true }), TOG('wl', 'START', WAVE_L, { virtual: true, def: 0 }), TOG('wr', 'END', WAVE_R, { virtual: true, def: 2 }),
      TOG('env', 'ENV', ['OFF', 'ON'], { virtual: true }), TOG('rel', 'RELEASE', ['SLOW', 'LONG', 'MED'], { virtual: true, def: 2 }), TOG('sens', 'SENS', ['LO', 'MED', 'HI'], { virtual: true, def: 1 }),
      FOOT({ label: 'TAP', cb: { tap: (c) => tapRate(c, 'ph.rate', 0.04, 10, c.ui.stg ? 1 : [1, 2, 4][c.ui.div | 0]) } }), FOOT({ label: 'BYPASS', cb: { tap: 'bypass' } }),
      LED({ bind: 'rate:on:ph.rate', color: '#ffb02e' }), bypassLed(),
    ],
    togCols: 3,
    dips: [{ p: 'stg', l: 'STAGES' }, { p: 'moto', l: 'MOTOBYP' }, { p: 'slow', l: 'SLOW' }, 'BOUNCE', 'SWEEP', 'TAP R/T', 'TOG T/S', 'FORM'],
    presets: [{ env: 1, sens: 2, 'ph.mix': 0.6 }, { 'ph.rate': 0.15, 'ph.feedback': 0.7 }],
    momentaryWhen: (ui) => ui.moto > 0.5,
    derive: (p) => ({
      'ph.stages': p.stg ? [2, 4, 6][p.div | 0] : 6,
      'ph.rate': (p['ph.rate'] ?? 0.4) * (p.slow ? 0.55 : 1),
      'ph.center': c01(0.5 + ((p.form ?? 0.5) - 0.5) * 0.5 + ((p.shape ?? 0.5) - 0.5) * 0.3),
      'e.on': p.env ? 1 : 0, 'e.sens': [0.3, 0.55, 0.85][p.sens ?? 1], 'e.range': [0.75, 0.6, 0.45][p.rel ?? 2],
      'v.level': ((p.vol ?? 0.5) - 0.5) * 24,
    }),
    desc: 'Signature six-stage phaser with an envelope section (ENV / RELEASE / SENS toggles) that adds a picking-dynamics filter sweep, MODUSHAPE morphing the modulation, and a SLOW mode DIP. Tap tempo with divisions, stages via DIP.',
  }));

  add(CB({
    id: 'cba.spectre', name: 'Phantasm', ref: 'Chase Bliss Spectre', code: 'PHANTASM', logo: 'PHANTASM', logoFont: "'Oswald', sans-serif", logoSize: 12, logoLs: 3,
    typeName: 'Analog through-zero flanger', cat: 'Modulation', art: 'prism', color: '#1f222b', text: '#eef0f6', algo: 'chain', cost: 0.8,
    opts: { chain: [{ prefix: 'fl', algo: 'flanger', params: { mode: 3 } }] },
    controls: [
      K('fl.mix', 'MIX', { def: 0.5 }), K('fl.manual', 'ZERO', { def: 0.65 }), K('fl.regen', 'REGEN', { def: 0.55 }),
      K('fl.speed', 'RATE', { def: 0.3 }), K('fl.width', 'WIDTH', { def: 0.6 }), K('shift', 'SHIFT', { def: 0.5, virtual: true }),
      TOG('div', '1 · 2 · 4', ['1', '2', '4'], { virtual: true }), TOG('wl', 'WAVE', WAVE_L, { virtual: true, def: 1 }), TOG('wr', 'WAVE', WAVE_R, { virtual: true, def: 1 }),
      FOOT({ label: 'TAP', cb: { tap: (c) => tapRate(c, 'fl.speed', 0.03, 8, [1, 2, 4][c.ui.div | 0]) } }), FOOT({ label: 'BYPASS', cb: { tap: 'bypass' } }),
      LED({ bind: 'rate:on:fl.speed', color: '#ffb02e' }), bypassLed(),
    ],
    dips: [{ p: 'pol', l: 'POLARITY' }, { p: 'moto', l: 'MOTOBYP' }, ...RAMP_DIPS, 'ZERO', 'REGEN'],
    presets: [{ 'fl.speed': 0.12, 'fl.regen': 0.8, 'fl.width': 0.8 }, { 'fl.manual': 0.3, 'fl.regen': 0.2, 'fl.mix': 0.4 }],
    momentaryWhen: (ui) => ui.moto > 0.5,
    derive: (p) => ({
      'fl.mode': p.pol ? 0 : 3,
      'fl.width': c01((p['fl.width'] ?? 0.6) * (1 - Math.abs((p.shift ?? 0.5) - 0.5) * 0.4) + (squareness(p) - 0.35) * 0.1),
    }),
    desc: 'Through-zero flanger: ZERO sets the delay (the zero point sits around 1–3 o\'clock), REGEN from chorus-like to self-oscillation, RATE / WIDTH / SHIFT shape the sweep. Tap tempo with divisions; DIP POLARITY switches to a conventional (positive) flange.',
  }));

  add(CB({
    id: 'cba.warped2', name: 'Bent Shellac MKII', ref: 'Chase Bliss Warped Vinyl MKII', code: 'BENT SHELLAC', logo: 'bent shellac', logoFont: "'Dancing Script', cursive", logoSize: 16, logoLs: 0.4,
    typeName: 'Analog chorus / vibrato', cat: 'Modulation', art: 'vinyl', color: '#efe5cf', text: '#2a1c14', palette: ['#1b1715', '#4d4440', '#d6402e', '#f4e7cf'], algo: 'chain', cost: 0.6,
    opts: { chain: [{ prefix: 'ch', algo: 'chorus', params: { mode: 1 } }] },
    controls: [
      K('ch.tone', 'TONE', { def: 0.6 }), K('ch.level', 'VOLUME', { def: 0.5 }), K('ch.mix', 'MIX', { def: 0.5 }),
      K('ch.rate', 'RPM', { def: 0.35 }), K('ch.depth', 'DEPTH', { def: 0.5 }), K('warp', 'WARP', { def: 0.5, virtual: true }),
      TOG('div', '1 · 2 · 4', ['1', '2', '4'], { virtual: true }), TOG('wl', 'WAVE', WAVE_L, { virtual: true, def: 0 }), TOG('wr', 'WAVE', WAVE_R, { virtual: true, def: 2 }),
      FOOT({ label: 'TAP', cb: { tap: (c) => tapRate(c, 'ch.rate', 0.06, 9, [1, 2, 4][c.ui.div | 0]) } }), FOOT({ label: 'BYPASS', cb: { tap: 'bypass' } }),
      LED({ bind: 'rate:on:ch.rate', color: '#ffb02e' }), bypassLed(),
    ],
    dips: [{ p: 'lofi', l: 'LO-FI' }, { p: 'moto', l: 'MOTOBYP' }, ...RAMP_DIPS, 'MIX', 'RPM'],
    presets: [{ 'ch.mix': 1, 'ch.rate': 0.55, 'ch.depth': 0.4 }, { 'ch.mix': 0.5, 'ch.rate': 0.15, 'ch.depth': 0.8, lofi: 1 }],
    momentaryWhen: (ui) => ui.moto > 0.5,
    derive: (p) => ({ 'ch.wave': c01(squareness(p) * 0.8 + Math.abs((p.warp ?? 0.5) - 0.5) * 0.4), 'ch.delay': p.lofi ? 0.9 : 0.4 }),
    desc: 'Bucket-brigade vibrato: MIX goes from dry through chorus (noon) to pure vibrato, RPM / DEPTH / WARP set the wobble, TONE darkens the wet side. Tap tempo with divisions; DIP LO-FI lengthens the delay line for a murkier, noisier vibrato.',
  }));

  // Condor family: EQ / filter / preamp with a drive footswitch
  const condor = (o) => CB(Object.assign({
    cat: 'EQ', art: 'wing', algo: 'chain', cost: 0.7,
    opts: { chain: [{ prefix: 'pre', algo: 'drive', opts: o.drive }, { prefix: 'eq', algo: 'pareq', params: { spectrum: 0, b2g: 0, b4g: 0, b6g: 0 } }] },
    controls: [
      K('pre.gain', 'GAIN', { def: 0.35 }), K('pre.level', 'VOLUME', { def: 0.6 }), K('bass', 'BASS', { def: 0.5, virtual: true }),
      K('freq', 'FREQ', { def: 0.45, virtual: true, display: (v) => Math.round(lmap(v, 150, 4200)) + ' Hz' }), K('mids', 'MIDS', { def: 0.5, virtual: true }), K('lpf', 'LPF', { def: 0.9, virtual: true }),
      TOG('bt', 'BASS', ['A', 'B', 'C'], { virtual: true }), TOG('mt', 'MIDS', ['A', 'B', 'C'], { virtual: true, def: 1 }), TOG('lt', 'LPF', ['A', 'B', 'C'], { virtual: true, def: 1 }),
      FOOT({ action: 'toggle', p: 'drv', label: 'DRIVE' }), FOOT({ label: 'BYPASS' }),
      LED({ bind: 'onparam:drv', color: '#ffb02e' }), bypassLed(),
    ],
    initParams: { drv: 0 },
    dips: ['BUFFER', { p: 'moto', l: 'MOTOBYP' }, 'DRIVE', 'RESET', 'GAIN', 'BASS', 'MIDS', 'LPF'],
    presets: [{ mids: 0.75, freq: 0.6, mt: 2, lpf: 0.7 }, { bass: 0.3, mids: 0.25, freq: 0.3, drv: 1, 'pre.gain': 0.6 }],
    momentaryWhen: (ui) => ui.moto > 0.5,
    derive: (p) => {
      const b = (p.bass ?? 0.5) - 0.5, lp = p.lpf ?? 0.9, lpf = lmap(lp, 400, 20000), lt = p.lt ?? 1;
      return {
        'pre.mode': p.drv ? 1 : 0,
        'eq.b1type': 1, 'eq.b1f': [110, 220, 450][p.bt | 0], 'eq.b1g': b > 0 ? b * 20 : b * 40, 'eq.b1q': 0.7,
        'eq.b3type': 0, 'eq.b3f': lmap(p.freq ?? 0.45, 150, 4200), 'eq.b3g': ((p.mids ?? 0.5) - 0.5) * 36, 'eq.b3q': [0.5, 1.2, 3][p.mt ?? 1],
        'eq.lpon': lp < 0.98 ? 1 : 0, 'eq.lpf': lpf, 'eq.lps': 1,
        'eq.b5on': lp < 0.98 && lt > 0 ? 1 : 0, 'eq.b5type': 0, 'eq.b5f': clamp(lpf * 0.9, 300, 18000), 'eq.b5g': [0, 4, 9][lt], 'eq.b5q': [0.7, 2, 4][lt],
      };
    },
  }, o));
  add(condor({
    id: 'cba.condor', name: 'Albatross', ref: 'Chase Bliss Condor', code: 'ALBATROSS', logo: 'ALBATROSS', logoSize: 12, logoLs: 2.5,
    typeName: 'Analog EQ / filter / preamp', color: '#c4532a', text: '#fff3e2', palette: ['#f2a65a', '#e8d6b0', '#8c2f16', '#5a1d0c', '#f6e7cc'],
    drive: { clip: 'opamp', tone: 'none', gainMinDb: 0, gainMaxDb: 28, postLp: 12000, modes: [{ clip: 'clean' }, { clip: 'opamp', gainMinDb: 8, gainMaxDb: 36 }] },
    desc: 'Analog preamp / EQ: BASS shelf (A/B/C reach), swept MIDS with FREQ and Q toggle, resonant LPF with three filter characters. The DRIVE footswitch pushes the gain stage into soft op-amp drive.',
  }));
  add(condor({
    id: 'cba.condor-hifi', name: 'Albatross HiFi', ref: 'Chase Bliss Condor HiFi', code: 'ALBATROSS HIFI', logo: 'ALBATROSS', logoSize: 12, logoLs: 2.5,
    typeName: 'HiFi EQ / filter / preamp', color: '#e7eaee', text: '#162538', palette: ['#5f8fd6', '#a9c6ea', '#21477d', '#0f2442', '#f2b63e'],
    drive: { clip: 'clean', tone: 'none', gainMinDb: 0, gainMaxDb: 24, modes: [{ clip: 'clean' }, { clip: 'jfet', gainMinDb: 6, gainMaxDb: 30, postLp: 16000 }] },
    desc: 'Higher-headroom, lower-noise version of the EQ / filter / preamp: BASS shelf, swept resonant MIDS, resonant LPF and a cleaner, more open DRIVE footswitch.',
  }));

  // ================================================================== gain stages
  const VOICE = [
    { clip: 'clean', gainMinDb: 0, gainMaxDb: 22 },
    { clip: 'ts', gainMinDb: 6, gainMaxDb: 38 },
    { clip: 'muff', gainMinDb: 18, gainMaxDb: 50, stages: 2, stage2Db: 6 },
  ];
  const driveOpts = (modes) => ({ tone: 'lp', toneLo: 900, toneHi: 9000, modes });
  add(CB({
    id: 'cba.brothers', name: 'Cousins', ref: 'Chase Bliss Brothers', code: 'COUSINS', logo: 'COUSINS', logoSize: 14, logoLs: 3,
    typeName: 'Analog gainstage', cat: 'Overdrive', art: 'twins', color: '#e3a33d', text: '#22170b', palette: ['#c8402f', '#2f5fa8', '#f4dcc0', '#f4dcc0', '#22170b'],
    algo: 'chain', cost: 1.4, stereo: 'mono',
    opts: { chain: [
      { prefix: 'b0', algo: 'drive', on: false, opts: driveOpts(VOICE) },
      { prefix: 'a', algo: 'drive', group: 1, opts: driveOpts(VOICE) },
      { prefix: 'bp', algo: 'drive', group: 1, on: false, opts: driveOpts(VOICE) },
      { prefix: 'b', algo: 'drive', opts: driveOpts(VOICE) },
      { prefix: 'out', algo: 'utility' },
    ] },
    controls: [
      K('ga', 'GAIN A', { def: 0.4, virtual: true }), K('master', 'MASTER', { def: 0.5, virtual: true }), K('gb', 'GAIN B', { def: 0.45, virtual: true }),
      K('ta', 'TONE A', { def: 0.55, virtual: true }), K('blend', 'BLEND', { def: 0.5, virtual: true }), K('tb', 'TONE B', { def: 0.5, virtual: true }),
      TOG('ma', 'CHANNEL A', ['BOOST', 'DRIVE', 'FUZZ'], { virtual: true, def: 1 }), TOG('rt', 'ORDER', ['A>B', 'A+B', 'B>A'], { virtual: true }), TOG('mb', 'CHANNEL B', ['BOOST', 'DRIVE', 'FUZZ'], { virtual: true, def: 0 }),
      FOOT({ action: 'toggle', p: 'chA', label: 'CHANNEL A' }), FOOT({ action: 'toggle', p: 'chB', label: 'CHANNEL B' }),
      LED({ bind: 'onparam:chA', color: '#ff3324' }), LED({ bind: 'onparam:chB', color: '#ff3324' }),
    ],
    initParams: { chA: 1, chB: 0 },
    dips: ['GAIN A', 'TONE A', 'MASTER', 'GAIN B', 'TONE B', 'BLEND', 'SWEEP', 'POLARITY'],
    presets: [{ ma: 2, ga: 0.6, chA: 1 }, { ma: 0, mb: 1, rt: 0, chA: 1, chB: 1 }],
    derive: (p) => {
      const A = (p.chA ?? 1) > 0.5, B = (p.chB ?? 0) > 0.5, rt = p.rt | 0, bl = p.blend ?? 0.5, par = rt === 1 && A && B;
      const bv = { gain: p.gb ?? 0.45, tone: p.tb ?? 0.5, mode: p.mb | 0, level: 0.5 };
      const o = { 'a.on': A ? 1 : 0, 'a.gain': p.ga ?? 0.4, 'a.tone': p.ta ?? 0.55, 'a.mode': p.ma ?? 1, 'a.level': 0.5,
        'b.on': B && rt === 0 ? 1 : 0, 'b0.on': B && rt === 2 ? 1 : 0, 'bp.on': B && rt === 1 ? 1 : 0,
        'a.lvl': par ? 2 * Math.min(1, 2 * (1 - bl)) : 1, 'bp.lvl': par ? 2 * Math.min(1, 2 * bl) : 1,
        'out.level': ((p.master ?? 0.5) - 0.5) * 24 };
      for (const pre of ['b0', 'bp', 'b']) for (const k in bv) o[pre + '.' + k] = bv[k];
      return o;
    },
    desc: 'Two analog gain channels, each a boost, drive or fuzz, run A into B, in parallel (BLEND balances them) or B into A. Each footswitch engages its channel; MASTER sets the overall output.',
  }));

  add(CB({
    id: 'cba.brothersam', name: 'Cousins AM', ref: 'Chase Bliss Brothers AM', code: 'COUSINS AM', logo: 'COUSINS AM', logoSize: 12, logoLs: 2.5,
    typeName: 'Dual gain channel', cat: 'Overdrive', art: 'radio', size: 'mk2', color: '#1e2331', text: '#f2e7cf', palette: ['#d88a3a', '#3b4766', '#f2e7cf', '#f0b04a'],
    algo: 'chain', cost: 1.1, stereo: 'mono',
    opts: { chain: [
      { prefix: 'a', algo: 'drive', opts: driveOpts(VOICE) },
      { prefix: 'b', algo: 'drive', opts: driveOpts([{ clip: 'ge', gainMinDb: 4, gainMaxDb: 26, preEq: [{ type: 'hp', f: 650, q: 0.7, db: 0 }, { type: 'peak', f: 2600, q: 0.8, db: 5 }] }, VOICE[1], { clip: 'si', gainMinDb: 14, gainMaxDb: 46 }]) },
      { prefix: 'eq', algo: 'peq' },
    ] },
    controls: [
      K('g2', 'GAIN 2', { def: 0.4, virtual: true }), K('v2', 'VOL 2', { def: 0.5, virtual: true }), K('g1', 'GAIN 1', { def: 0.35, virtual: true }),
      K('t2', 'TONE 2', { def: 0.55, virtual: true }), K('v1', 'VOL 1', { def: 0.5, virtual: true }), K('t1', 'TONE 1', { def: 0.5, virtual: true }),
      TOG('m2', 'MODE 2', ['BOOST', 'OD', 'DIST'], { virtual: true, def: 0, col: 0 }), TOG('m1', 'MODE 1', ['BOOST', 'OD', 'DIST'], { virtual: true, def: 1, col: 2 }),
      FOOT({ action: 'toggle', p: 'c1', label: 'BYPASS 1' }), FOOT({ action: 'toggle', p: 'c2', label: 'BYPASS 2' }),
      LED({ bind: 'onparam:c1', color: '#ff3324' }), LED({ bind: 'onparam:c2', color: '#ff3324' }),
    ],
    initParams: { c1: 1, c2: 0 },
    dips: [{ p: 'hg', l: 'HI GAIN' }, 'MOTOBYP 1', 'MOTOBYP 2', { p: 'pl', l: 'PRES LINK' }, { p: 'mst', l: 'MASTER' }, 'BANK', 'SWEEP', 'POLARITY'],
    presets: [{ c1: 1, c2: 1, m2: 0, g2: 0.6 }, { m1: 2, g1: 0.6, c1: 1 }],
    derive: (p) => {
      const hg = p.hg ? 1.25 : 1, lv = (v) => 0.3 + 0.4 * v;
      return {
        'a.on': (p.c1 ?? 1) > 0.5 ? 1 : 0, 'b.on': (p.c2 ?? 0) > 0.5 ? 1 : 0,
        'a.gain': c01((p.g1 ?? 0.35) * hg), 'a.tone': p.t1 ?? 0.5, 'a.mode': p.m1 ?? 1, 'a.level': p.mst ? 0.5 : lv(p.v1 ?? 0.5),
        'b.gain': c01((p.g2 ?? 0.4) * hg), 'b.tone': p.t2 ?? 0.55, 'b.mode': p.m2 | 0, 'b.level': lv(p.v2 ?? 0.5),
        'eq.highfreq': 3500, 'eq.highgain': p.pl ? ((p.t1 ?? 0.5) - 0.5) * 8 : 0,
      };
    },
    desc: 'Two stacked gain channels (1 into 2), each boost / overdrive / distortion; channel 2\'s boost is a germanium-style treble booster. DIP HI GAIN adds about 25 % gain, PRES LINK ties presence to TONE 1, MASTER turns VOL 2 into a master volume.',
  }));

  // ================================================================== creative compressor
  add(CB({
    id: 'cba.clean', name: 'Spotless', ref: 'Chase Bliss Clean', code: 'SPOTLESS', logo: 'spotless', logoFont: "'Inter', sans-serif", logoWeight: 800, logoSize: 15, logoLs: 1,
    typeName: 'Dynamic compressor', cat: 'Dynamics', art: 'rgb', size: 'mk2', color: '#f3f2ee', text: '#1a1a1e', algo: 'chain', cost: 1,
    opts: { chain: [
      { prefix: 'gt', algo: 'gate', on: false, params: { threshold: 0.25 } },
      { prefix: 'sw', algo: 'swell', on: false },
      { prefix: 'c', algo: 'comp', opts: { type: 'vca' } },
      { prefix: 'sag', algo: 'drive', on: false, opts: { clip: 'tube', tone: 'none', gainMinDb: 0, gainMaxDb: 18 } },
      { prefix: 'dy', algo: 'drive', on: false, opts: { clip: 'asym', tone: 'none', gainMinDb: 4, gainMaxDb: 20 } },
      { prefix: 'f', algo: 'wah', on: false, params: { filter: 0, q: 0.15, range: 0.35, level: 0.5 } },
      { prefix: 'eq', algo: 'peq' },
      { prefix: 'ph', algo: 'tremolo', on: false, params: { mode: 0 } },
    ] },
    controls: [
      K('dyn', 'DYNAMICS', { def: 0.4, virtual: true }), K('c.sustain', 'SENSITIVITY', { def: 0.5 }), K('wet', 'WET', { def: 0.6, virtual: true }),
      K('c.attack', 'ATTACK', { def: 0.3 }), K('eqk', 'EQ', { def: 0.5, virtual: true }), K('dry', 'DRY', { def: 0.15, virtual: true }),
      TOG('rel', 'RELEASE', ['FAST', 'USER', 'SLOW'], { virtual: true, def: 1 }), TOG('eqm', 'EQ MODE', ['SHIFT', 'MAN', 'MOD'], { virtual: true, def: 1 }), TOG('phy', 'PHYSICS', ['WOB', 'STBL', 'TWCH'], { virtual: true, def: 1 }),
      FOOT({ action: 'toggle', p: 'sw.on', label: 'AUX · SWELL' }),
      FOOT({ label: 'BYPASS', cb: { tap: 'bypass', hold: (c) => c.set('sagH', 1), release: (c) => c.set('sagH', 0) } }),
      LED({ bind: 'onparam:sw.on', color: '#3fa8ff' }), bypassLed(),
      K('sagH', 'SAG HOLD', { def: 0, virtual: true, hidden: true }),
    ],
    dips: [{ p: 'dusty', l: 'DUSTY' }, 'SWELL AUX', 'MOTION', { p: 'gate', l: 'GATE' }, 'SIDECHAIN', 'LATCH', 'SPREAD', 'MISO'],
    presets: [{ dyn: 0.8, wet: 0.5, dry: 0.5, dusty: 1 }, { dyn: 0.3, eqm: 0, phy: 0 }],
    derive: (p) => {
      const dyn = p.sagH ? 1 : p.dyn ?? 0.4, wet = p.wet ?? 0.6, dry = p.dry ?? 0.15, sum = wet + dry + 1e-3, eqv = (p.eqk ?? 0.5) - 0.5, eqm = p.eqm ?? 1, phy = p.phy ?? 1;
      return {
        'c.ratio': c01(dyn * 1.6), 'c.release': [0.12, 0.45, 0.85][p.rel ?? 1], 'c.blend': wet / sum, 'c.level': clamp(0.24 + 0.2 * sum, 0, 1),
        'sag.on': dyn > 0.75 ? 1 : 0, 'sag.gain': c01((dyn - 0.75) * 3), 'sag.level': 0.5,
        'dy.on': p.dusty ? 1 : 0, 'dy.gain': 0.35, 'dy.level': 0.5, 'gt.on': p.gate ? 1 : 0,
        'f.on': eqm === 1 ? 0 : 1, 'f.mode': eqm === 0 ? 2 : 1, 'f.rate': 0.2, 'f.pos': 0.7,
        'eq.lowfreq': 160, 'eq.lowgain': -eqv * 12, 'eq.highfreq': 3000, 'eq.highgain': eqv * 12,
        'ph.on': phy === 1 ? 0 : 1, 'ph.depth': phy === 0 ? 0.07 : 0.14, 'ph.rate': phy === 0 ? 0.2 : 0.75, 'ph.wave': phy === 0 ? 0 : 0.6,
      };
    },
    desc: 'Two-stage VCA compressor / limiter: DYNAMICS sweeps from light compression through limiting into a tube-sag zone, SENSITIVITY is the threshold, WET / DRY blend parallel compression. EQ MODE adds an envelope-shifted or modulated EQ, PHYSICS a little envelope wobble. AUX engages the volume swell; hold BYPASS for maximum sag. DIPs DUSTY (gritty limiter) and GATE work.',
  }));

  // ================================================================== micro-looper / glitch / loopers
  add(CB({
    id: 'cba.onward', name: 'Forthwith', ref: 'Chase Bliss Onward', code: 'FORTHWITH', logo: 'forthwith', logoFont: "'Oswald', sans-serif", logoSize: 15, logoLs: 2,
    typeName: 'Freeze / glitch sampler', cat: 'Multi-FX', kind: 'Pedal', art: 'arrows', size: 'mk2', color: '#2a1e4a', text: '#f3eefc', palette: ['#ff7a59', '#ffc94a', '#6fd3c7', '#b78cff'],
    algo: 'chain', cost: 3.2,
    opts: { chain: [
      DRY('d1', 1),
      { prefix: 'fz', algo: 'chain', group: 1, lvlDef: 2, opts: { chain: [
        { prefix: 'f', algo: 'freeze', params: { dry: 0, mix: 1, mode: 0 } },
        { prefix: 'o', algo: 'pitch', on: false, params: { dry: 1, level1: 0 } },
        { prefix: 'tx', algo: 'crusher', on: false }, { prefix: 'td', algo: 'drive', on: false, opts: { clip: 'tube', tone: 'none', gainMinDb: 0, gainMaxDb: 20 } },
        { prefix: 'an', algo: 'chorus', on: false },
      ] } },
      DRY('d2', 2),
      { prefix: 'gl', algo: 'chain', group: 2, lvlDef: 2, opts: { chain: [
        { prefix: 'm', algo: 'microloop', params: { dry: 0, mode: 0, mix: 0.72 } },
        { prefix: 'o', algo: 'pitch', on: false, params: { dry: 1, level1: 0 } },
        { prefix: 'tx', algo: 'crusher', on: false }, { prefix: 'td', algo: 'drive', on: false, opts: { clip: 'tube', tone: 'none', gainMinDb: 0, gainMaxDb: 20 } },
        { prefix: 'an', algo: 'chorus', on: false },
      ] } },
    ] },
    controls: [
      K('mix', 'MIX', { def: 0.5, virtual: true }), K('size', 'SIZE', { def: 0.4, virtual: true }), K('oct', 'OCTAVE', { def: 0.5, virtual: true }),
      K('tex', 'TEXTURE', { def: 0.5, virtual: true }), K('sus', 'SUSTAIN', { def: 0.75, virtual: true }), K('err', 'ERROR', { def: 0.2, virtual: true }),
      TOG('fade', 'FADE', ['SLOW', 'USER', 'FAST'], { virtual: true, def: 1 }), TOG('type', 'TYPE', ['TIME', 'COND', 'PLAY'], { virtual: true }), TOG('anim', 'ANIMATE', ['NONE', 'VIB', 'CHOR'], { virtual: true }),
      FOOT({ label: 'FREEZE', cb: { tap: (c) => { c.ev('fz', 1); c.toggle('fzOn'); } } }),
      FOOT({ label: 'GLITCH', cb: { tap: (c) => { c.ev('gl', 1); c.toggle('glOn'); } } }),
      LED({ bind: 'onparam:fzOn', color: '#6fd3ff' }), LED({ bind: 'onparam:glOn', color: '#ff7a59' }),
      K('fzOn', 'FREEZE ON', { def: 0, virtual: true, hidden: true }), K('glOn', 'GLITCH ON', { def: 0, virtual: true, hidden: true }),
    ],
    dips: ['MISO', 'SPREAD', 'LATCH', 'SIDECHAIN', 'DUCK', { p: 'rev', l: 'REVERSE' }, { p: 'half', l: '½ SPEED' }, 'MANUAL'],
    presets: [{ oct: 0.1, anim: 1, sus: 1 }, { err: 0.7, type: 2, size: 0.2, tex: 0.25 }],
    derive: (p) => {
      const mix = p.mix ?? 0.5, oct = (p.oct ?? 0.5) - 0.5, tex = (p.tex ?? 0.5) - 0.5, e = p.err ?? 0.2, ty = p.type | 0, an = p.anim | 0, size = p.size ?? 0.4, sus = p.sus ?? 0.75;
      let speed = (p.half ? 0.5 : 1) * (p.rev ? -1 : 1);
      if (ty === 2 && e > 0.33) speed *= e > 0.66 ? -1 : 0.5;
      const o = { 'd1.lvl': dn(mix), 'd2.lvl': 2, 'fz.lvl': up(mix), 'gl.lvl': up(mix),
        'fz.f.decay': sus, 'fz.f.speed': size, 'gl.m.length': 0.05 + 1.2 * size * size, 'gl.m.decay': sus, 'gl.m.speed': speed,
        'gl.m.fade': [0.9, 0.35, 0.05][p.fade ?? 1], 'gl.m.stretch': ty === 0 ? e * 0.8 : 0 };
      for (const L of ['fz', 'gl']) Object.assign(o, {
        [L + '.o.on']: Math.abs(oct) > 0.03 ? 1 : 0, [L + '.o.semis1']: oct < 0 ? -12 : 12, [L + '.o.level1']: Math.abs(oct) * 2,
        [L + '.tx.on']: tex < -0.03 || (ty === 1 && e > 0.05) ? 1 : 0, [L + '.tx.bits']: c01(1 - Math.max(-tex, 0) * 1.4 - (ty === 1 ? e * 0.5 : 0)), [L + '.tx.rate']: c01(0.6 - Math.max(-tex, 0)),
        [L + '.td.on']: tex > 0.03 ? 1 : 0, [L + '.td.gain']: tex * 1.6, [L + '.td.level']: 0.5,
        [L + '.an.on']: an ? 1 : 0, [L + '.an.mode']: an === 1 ? 1 : 0, [L + '.an.mix']: an === 1 ? 1 : 0.5, [L + '.an.rate']: 0.2 + size * 0.5,
      });
      return o;
    },
    desc: 'Two sides: FREEZE holds a smooth spectral sustain, GLITCH loops a short fragment (SIZE). OCTAVE adds an octave up / down voice, TEXTURE crushes (left) or saturates (right), SUSTAIN sets how long sounds hold, ERROR adds timing (stretch), condition (crush) or playback (half speed / reverse) faults. ANIMATE adds vibrato or chorus; DIPs REVERSE and ½ SPEED change the glitch playback.',
  }));

  // MOOD-style two-channel pedal (wet channel + micro-looper with routing), shared by the MKII and the grumpy one
  const moodChain = (wetLanes, loopLane) => [
    DRY('dA', 1), Object.assign({}, loopLane('m1'), { group: 1 }),
    DRY('dB', 2), ...wetLanes.map((l) => Object.assign({}, l, { group: 2 })), POST('p2', dB((1 + wetLanes.length) / 2)),
    DRY('dC', 3), Object.assign({}, loopLane('m3'), { group: 3 }),
  ];
  // routing: IN = wet first, the looper records the result; IN+LOOP / LOOP = looper first, wet processes it
  const moodLevels = (p, wets, loopKey) => {
    const mix = p.mix ?? 0.5, rt = p.rt ?? 1, wOn = (p.wetOn ?? 1) > 0.5, lOn = (p.loopOn ?? 0) > 0.5, dk = !!p.dk;
    const o = { 'dA.lvl': 2, 'dB.lvl': 2, 'dC.lvl': 2 };
    if (rt === 0) { o['m1.lvl'] = 0; o['m3.lvl'] = lOn ? up(mix) : 0; if (dk) o['dB.lvl'] = 0; }
    else { o['m3.lvl'] = 0; o['m1.lvl'] = lOn ? up(mix) : 0; if (dk || rt === 2) o['dA.lvl'] = dk ? 0 : 2; }
    if (!dk && rt !== 2) o[rt === 0 ? 'dB.lvl' : 'dA.lvl'] = 2 * Math.min(1, 2 * (1 - mix)) + (rt === 0 ? 0 : 0);
    if (rt === 0) o['dB.lvl'] = dk ? 0 : dn(mix) || 0;
    wets.forEach((k, i) => (o[k + '.lvl'] = wOn && (p.wm | 0) === i ? up(mix) * 0.85 : 0));
    o[loopKey] = rt === 0 ? 'm3' : 'm1';
    return o;
  };
  const loopFoot = (modeHasEvents) => ({
    tap: (c) => {
      const tgt = (c.ui.rt ?? 1) === 0 ? 'm3' : 'm1';
      if (modeHasEvents(c.ui)) c.ev(tgt, 1);
      c.toggle('loopOn');
    },
  });

  add(CB({
    id: 'cba.mood2', name: 'Temper MKII', ref: 'Chase Bliss MOOD MKII', code: 'TEMPER', logo: 'TEMPER', logoFont: "'Oswald', sans-serif", logoSize: 16, logoLs: 5,
    typeName: 'Wet channel + micro-looper', cat: 'Multi-FX', kind: 'Pedal', art: 'moon', size: 'mk2', color: '#bcd9dc', text: '#14303a', palette: ['#2f6d7a', '#7fb3b8', '#f6e6b8', '#fff7dc', '#14303a'],
    knob: 'cream', algo: 'chain', cost: 3.4,
    opts: { chain: moodChain([
      WET('rv', 'reverb', { params: { mix: 0.67, mode: 6, decay: 0.6 } }),
      WET('dl', 'delay', { opts: { maxMs: 1600 }, params: { mix: 0.72, feedback: 0.4, mode: 4, moddepth: 0.15 } }),
      { prefix: 'sl', algo: 'microloop', lvlDef: 0, params: { dry: 0, mode: 2, mix: 0.72 } },
    ], (k) => ({ prefix: k, algo: 'microloop', lvlDef: 0, params: { dry: 0, mode: 0, mix: 0.72 } })) },
    controls: [
      K('time', 'TIME', { def: 0.5, virtual: true }), K('mix', 'MIX', { def: 0.5, virtual: true }), K('len', 'LENGTH', { def: 0.45, virtual: true }),
      K('wmod', 'MODIFY', { def: 0.5, virtual: true }), K('clock', 'CLOCK', { def: 0.6, virtual: true }), K('lmod', 'MODIFY', { def: 0.75, virtual: true }),
      TOG('wm', 'WET', ['REVERB', 'DELAY', 'SLIP'], { virtual: true }), TOG('rt', 'ROUTING', ['IN', 'IN+LP', 'LOOP'], { virtual: true, def: 1 }), TOG('lm', 'LOOP', ['ENV', 'TAPE', 'STRCH'], { virtual: true, def: 1 }),
      FOOT({ label: 'WET', cb: { tap: (c) => c.toggle('wetOn'),
        hold: (c) => { const m = c.ui.wm | 0; if (m === 2) c.ev('sl', 1); else c.ev(m ? 'dl' : 'rv', 2, 1); },
        release: (c) => { const m = c.ui.wm | 0; if (m < 2) c.ev(m ? 'dl' : 'rv', 2, 0); } } }),
      FOOT({ label: 'LOOP', cb: loopFoot((ui) => (ui.lm ?? 1) !== 0) }),
      LED({ bind: 'onparam:wetOn', color: '#ff3324' }), LED({ bind: 'onparam:loopOn', color: '#3ddc84' }),
      K('wetOn', 'WET ON', { def: 1, virtual: true, hidden: true }), K('loopOn', 'LOOP ON', { def: 0, virtual: true, hidden: true }),
    ],
    dips: ['MISO', 'SPREAD', { p: 'dk', l: 'DRY KILL' }, 'TRAILS', 'LATCH', 'NO DUB', 'SMOOTH', { p: 'classic', l: 'CLASSIC' }],
    presets: [{ wm: 0, time: 0.85, wmod: 0.8, mix: 0.6 }, { wm: 2, time: 0.3, wmod: 0.1, lm: 2 }],
    derive: (p) => {
      const t = p.time ?? 0.5, wm = (p.wmod ?? 0.5), lm = p.lm ?? 1, lmod = (p.lmod ?? 0.75), clk = p.clock ?? 0.6, ls = lmap(clk, 2, 0.5) * (p.len ?? 0.45);
      const tone = 0.4 + 0.6 * clk;
      const o = moodLevels(p, ['rv', 'dl', 'sl'], '_lt');
      delete o._lt;
      Object.assign(o, {
        'rv.x.decay': 0.3 + 0.67 * t, 'rv.x.diffusion': 0.4 + 0.55 * wm, 'rv.x.mod': 0.15 + 0.6 * wm, 'rv.x.tone': tone, 'rv.x.mode': p.classic ? 2 : 6,
        'dl.x.time': lmap(t, 40, 1500), 'dl.x.feedback': wm * 1.02, 'dl.x.tone': tone, 'dl.x.mode': p.classic ? 1 : 4,
        'sl.length': lmap(t, 0.06, 1.2), 'sl.speed': wm < 0.5 ? -(0.25 + (0.5 - wm) * 3.5) : 0.25 + (wm - 0.5) * 3.5,
      });
      for (const m of ['m1', 'm3']) Object.assign(o, {
        [m + '.mode']: lm === 0 ? 2 : 0, [m + '.tone']: tone,
        [m + '.length']: clamp(lm === 1 ? 0.15 + ls * 3.5 : 0.05 + ls * 0.9, 0.03, 4),
        [m + '.speed']: lm === 1 ? (lmod < 0.5 ? -(0.25 + (0.5 - lmod) * 3.5) : 0.25 + (lmod - 0.5) * 3.5) : lm === 2 && lmod < 0.5 ? -1 : 1,
        [m + '.stretch']: lm === 2 ? Math.abs(lmod - 0.5) * 2 : 0, [m + '.decay']: lm === 0 ? 0.3 + 0.6 * lmod : 1,
      });
      return o;
    },
    desc: 'Two channels. WET: modulated reverb (TIME = decay, MODIFY = smear), delay (time / feedback) or slip (re-captured slices played at MODIFY speed / reverse). LOOP: an always-listening micro-looper – ENV (slices triggered by your playing), TAPE (LENGTH + speed / direction) or STRETCH. ROUTING sets whether the looper captures the wet sound (IN) or the wet channel processes the loop (IN+LOOP / LOOP). CLOCK trades loop length for fidelity. Tap WET to toggle the channel, hold it to freeze; tap LOOP to capture / release.',
  }));

  add(CB({
    id: 'cba.badmood', name: 'Bad Temper', ref: 'Chase Bliss Bad Mood', code: 'BAD TEMPER', logo: 'BAD TEMPER', logoFont: "'Oswald', sans-serif", logoSize: 13, logoLs: 3,
    typeName: 'Ambient mischief', cat: 'Multi-FX', kind: 'Pedal', art: 'storm', size: 'mk2', color: '#b5332c', text: '#f6efe8', palette: ['#6f6a68', '#9a9592', '#d7d2cc', '#ffd34a', '#c9c4c0'],
    knob: 'cream', algo: 'chain', cost: 4,
    opts: { chain: [...moodChain([
      WET('so', 'reverb', { params: { mix: 0.67, mode: 5, decay: 0.75 } }),
      WET('re', 'delay', { opts: { maxMs: 1600 }, params: { mix: 0.72, feedback: 0.85 } }),
      WET('fp', 'delay', { opts: { maxMs: 1200 }, params: { mix: 0.72, feedback: 0.3, mode: 0 }, post: [{ prefix: 'p', algo: 'pitch', params: { dry: 0, level1: 0.8, level2: 0.55, semis1: 7, semis2: 12 } }] }),
    ], (k) => ({ prefix: k, algo: 'chain', lvlDef: 0, opts: { chain: [
      { prefix: 'm', algo: 'microloop', params: { dry: 0, mode: 0, mix: 0.72 } },
      { prefix: 'sl', algo: 'slicer', on: false, params: { steps: 8 } },
      { prefix: 'ch', algo: 'chorus', on: false, params: { mode: 2, mix: 0.6 } },
      { prefix: 'cr', algo: 'crusher', on: false },
    ] } })), { prefix: 'glue', algo: 'drive', on: false, opts: { clip: 'tube', tone: 'none', gainMinDb: 0, gainMaxDb: 16 } }] },
    controls: [
      K('time', 'TIME', { def: 0.5, virtual: true }), K('mix', 'MIX', { def: 0.5, virtual: true }), K('len', 'LENGTH', { def: 0.5, virtual: true }),
      K('wmod', 'MODIFY', { def: 0.5, virtual: true }), K('clock', 'CLOCK', { def: 0.6, virtual: true }), K('lmod', 'MODIFY', { def: 0.5, virtual: true }),
      TOG('wm', 'WET', ['SOUP', 'RELAY', 'FLIP'], { virtual: true }), TOG('rt', 'ROUTING', ['IN', 'IN+LP', 'LOOP'], { virtual: true, def: 1 }), TOG('lm', 'LOOP', ['BURST', 'RADIO', 'MASK'], { virtual: true, def: 1 }),
      FOOT({ label: 'WET', cb: { tap: (c) => c.toggle('wetOn'),
        hold: (c) => c.ev(['so', 're', 'fp'][c.ui.wm | 0], 2, 1), release: (c) => c.ev(['so', 're', 'fp'][c.ui.wm | 0], 2, 0) } }),
      FOOT({ label: 'LOOP', cb: loopFoot(() => true) }),
      LED({ bind: 'onparam:wetOn', color: '#ff3324' }), LED({ bind: 'onparam:loopOn', color: '#3ddc84' }),
      K('wetOn', 'WET ON', { def: 1, virtual: true, hidden: true }), K('loopOn', 'LOOP ON', { def: 0, virtual: true, hidden: true }),
    ],
    dips: ['MISO', 'SPREAD', { p: 'dk', l: 'DRY KILL' }, 'TRAILS', 'LATCH', 'SMOOTH', { p: 'dglue', l: 'DRY GLUE' }, { p: 'half', l: 'HALF' }],
    presets: [{ wm: 0, time: 0.9, clock: 0.3, mix: 0.65 }, { wm: 2, wmod: 0.8, lm: 0, lmod: 0.6 }],
    derive: (p) => {
      const t = p.time ?? 0.5, wm = p.wmod ?? 0.5, lm = p.lm ?? 1, lmod = p.lmod ?? 0.5, len = p.len ?? 0.5, clk = p.clock ?? 0.6, tone = 0.35 + 0.65 * clk;
      const o = moodLevels(p, ['so', 're', 'fp'], '_lt');
      delete o._lt;
      const flip = [[5, 7], [7, 12], [12, 19], [-12, 12], [-5, 7], [-12, -24]][Math.min(5, Math.floor(wm * 6))];
      Object.assign(o, {
        'so.x.decay': 0.5 + 0.48 * t, 'so.x.diffusion': 0.5 + 0.5 * wm, 'so.x.mod': 0.2 + 0.7 * wm, 'so.x.tone': tone,
        're.x.time': lmap(t, 60, 1500), 're.x.feedback': 0.6 + 0.45 * wm, 're.x.tone': tone,
        'fp.x.time': lmap(t, 30, 900), 'fp.p.semis1': flip[0], 'fp.p.semis2': flip[1],
        'glue.on': p.dglue ? 1 : 0, 'glue.gain': 0.3, 'glue.level': 0.5,
      });
      const station = Math.min(4, Math.floor(lmod * 5));
      for (const m of ['m1', 'm3']) {
        const L = (p.half ? 0.5 : 1) * lmap(clk, 1.6, 0.6);
        Object.assign(o, {
          [m + '.m.length']: clamp(lm === 0 ? 0.4 + 1.6 * len : 0.2 + 2.4 * len * L, 0.05, 4), [m + '.m.tone']: tone,
          [m + '.m.speed']: lm === 1 ? [len < 0.5 ? -(0.5 + (0.5 - len) * 3) : 0.5 + (len - 0.5) * 3, 1, 1, 1, pick(len, [0.5, 1, 2])][station] : 1,
          [m + '.m.stretch']: lm === 1 && (station === 1 || station === 3) ? 0.3 + 0.7 * len : 0,
          [m + '.sl.on']: lm === 0 ? 1 : 0, [m + '.sl.time']: lmap(1 - len, 60, 400), [m + '.sl.depth']: 0.4 + 0.6 * lmod, [m + '.sl.pattern']: 3 + Math.floor(lmod * 10),
          [m + '.ch.on']: lm === 1 && (station === 2 || station === 3) ? 1 : 0, [m + '.ch.depth']: 0.3 + 0.6 * len,
          [m + '.cr.on']: lm === 2 ? 1 : 0, [m + '.cr.bits']: 0.2 + 0.6 * (1 - len), [m + '.cr.mix']: lmod,
        });
      }
      return o;
    },
    desc: 'The grumpy two-channel sibling: WET is SOUP (resynthesised ambient reverb), RELAY (repeats that don\'t fade) or FLIP (harmonies lagging behind you, MODIFY picks the intervals). The micro-looper is BURST (sliced rhythmic steps), RADIO (five stations: tape, ambient, orchestral, shoegaze, dance – MODIFY scans) or MASK (crushes the loud parts). Hold WET to freeze, tap LOOP to capture. DIPs DRY KILL, DRY GLUE (saturator on everything) and HALF work.',
  }));

  add(CB({
    id: 'cba.blooper', name: 'Bubbler', ref: 'Chase Bliss Blooper', code: 'BUBBLER', logo: 'bubbler', logoFont: "'Oswald', sans-serif", logoSize: 16, logoLs: 2,
    typeName: 'Bottomless looper', cat: 'Looper', art: 'bubbles', size: 'mk2', color: '#f4ede0', text: '#25252e', palette: ['#ff7b6b', '#ffc84a', '#5cc7b2', '#6b8cff', '#d58cff'],
    algo: 'chain', cost: 2.4, alwaysOn: true,
    opts: { chain: [
      DRY('dry', 1),
      { prefix: 'w', algo: 'chain', group: 1, lvlDef: 2, opts: { chain: [
        { prefix: 'lp', algo: 'looper', group: 1, lvlDef: 2, opts: { tracks: 1, maxSec: 60 }, params: { level1: 1, master: 1, recAction: 1 } },
        { prefix: 'n', algo: 'utility', group: 1, lvlDef: 2, params: { invert: 1 } },
        { prefix: 'st', algo: 'lofi', on: false, params: { mode: 0 } },
        { prefix: 'pa', algo: 'pitch', on: false, params: { dry: 0, level1: 1, semis1: 0 } },
        { prefix: 'ml', algo: 'microloop', on: false, params: { mode: 2 } },
        { prefix: 'sl', algo: 'slicer', on: false },
        { prefix: 'f', algo: 'wah', on: false, params: { mode: 0, q: 0.3, level: 0.5 } },
        { prefix: 'g', algo: 'utility' },
      ] } },
    ] },
    controls: [
      K('vol', 'VOLUME', { def: 0.5, virtual: true }), K('w.lp.level1', 'LAYERS', { def: 1 }), K('rep', 'REPEATS', { def: 1, virtual: true }),
      K('ka', 'MOD A', { def: 0.5, virtual: true }), K('stab', 'STABILITY', { def: 0, virtual: true }), K('kb', 'MOD B', { def: 0.5, virtual: true }),
      TOG('sa', 'MOD A', ['SPD', 'DROP', 'TRIM'], { virtual: true }), TOG('mode', 'MODE', ['NORM', 'ADD', 'SMPL'], { virtual: true }), TOG('sb', 'MOD B', ['STEP', 'FILT', 'SCRM'], { virtual: true }),
      BTN('A', { p: 'ma', toggle: true, led: true, ledColor: '#ffb02e', ledDy: -8.5, bind: 'param:ma' }), BTN('B', { p: 'mb', toggle: true, led: true, ledColor: '#ffb02e', ledDy: -8.5, bind: 'param:mb' }),
      FOOT({ label: 'REC / PLAY', cb: { tap: (c) => c.ev('w', 1), hold: (c) => c.ev('w', 4), holdMs: 900 } }),
      FOOT({ label: 'STOP', cb: { tap: (c) => c.ev('w', 2), hold: (c) => c.ev('w', 3), holdMs: 1200 } }),
      LED({ bind: 'fn', ledFn: loopLed(['w', 'lp']) }), LED({ bind: 'fn', ledFn: loopLed(['w', 'lp'], 'stop') }),
    ],
    dips: [{ p: 'dk', l: 'DRY KILL' }, { p: 'half', l: 'HALF' }, 'MISO', 'SPREAD', 'TRAILS', 'BOUNCE', 'SWEEP', 'POLARITY'],
    presets: [{ ma: 1, sa: 0, ka: 0.25, stab: 0.4 }, { mb: 1, sb: 2, kb: 0.8, ma: 1, sa: 2, ka: 0.8 }],
    derive: (p) => {
      const a = ((p.ka ?? 0.5) - 0.5) * 2, b = ((p.kb ?? 0.5) - 0.5) * 2, A = !!p.ma, B = !!p.mb, sa = p.sa | 0, sb = p.sb | 0, s = p.stab ?? 0;
      let semis = p.half ? -12 : 0;
      if (A && sa === 0) semis += a * 12;
      if (B && sb === 0) semis += pick(p.kb ?? 0.5, [-12, -7, -5, 0, 5, 7, 12]);
      const drop = A && sa === 1 && Math.abs(a) > 0.05, scr = B && sb === 2 && Math.abs(b) > 0.05, trim = A && sa === 2 && Math.abs(a) > 0.05, filt = B && sb === 1 && Math.abs(b) > 0.05;
      return {
        'dry.lvl': p.dk ? 0 : 2, 'w.g.level': dB(2 * (p.vol ?? 0.5)), 'w.lp.dubLevel': 0.4 + 0.6 * (p.rep ?? 1), 'w.lp.recAction': [1, 0, 1][p.mode | 0],
        'w.st.on': s > 0.02 ? 1 : 0, 'w.st.wow': s * 0.8, 'w.st.flutter': s * 0.6, 'w.st.age': s * 0.7, 'w.st.noise': s * 0.25,
        'w.pa.on': Math.abs(semis) > 0.05 ? 1 : 0, 'w.pa.semis1': clamp(semis, -24, 24),
        'w.sl.on': drop || scr ? 1 : 0, 'w.sl.pattern': scr ? 13 : 9, 'w.sl.depth': Math.max(drop ? Math.abs(a) : 0, scr ? Math.abs(b) : 0),
        'w.ml.on': trim ? 1 : 0, 'w.ml.length': 0.08 + (1 - Math.abs(a)) * 0.8, 'w.ml.dry': 1 - Math.abs(a),
        'w.f.on': filt ? 1 : 0, 'w.f.filter': b < 0 ? 0 : 2, 'w.f.pos': b < 0 ? 1 - Math.abs(b) * 0.85 : Math.abs(b) * 0.85,
      };
    },
    desc: 'Looper with modifiers. Left: record / play (hold = undo), right: stop (hold = clear). LAYERS sets the loop playback level, REPEATS fades older layers while overdubbing, STABILITY adds tape wow / flutter / noise. MOD A (speed, dropper, trimmer) and MOD B (stepped speed, filter, scrambler) act on the loop when their buttons are lit; noon is neutral. MODE: normal, additive (record into overdub) or sampler.',
  }));

  add(CB({
    id: 'cba.habit', name: 'Routine', ref: 'Chase Bliss Habit', code: 'ROUTINE', logo: 'routine', logoFont: "'Oswald', sans-serif", logoSize: 16, logoLs: 2.5,
    typeName: 'Echo collector', cat: 'Delay', art: 'spiral', size: 'mk2', color: '#3d6a59', text: '#eef6ea', palette: ['#25473b', '#5c9a80', '#f2d27a', '#f4f0e0', '#e86f4c'],
    algo: 'chain', cost: 3,
    opts: { chain: [
      DRY('d', 1),
      WET('w', 'delay', { group: 1, opts: { maxMs: 6000 }, params: { mix: 0.72, feedback: 0.45, age: 0.1, sat: 0.1 }, post: [
        { prefix: 'mf', algo: 'wah', on: false, params: { mode: 0, q: 0.25, level: 0.5 } },
        { prefix: 'mp', algo: 'pitch', on: false, params: { dry: 1, level1: 0, semis1: 12 } },
        { prefix: 'ms', algo: 'slicer', on: false },
      ] }),
      { prefix: 'sc', algo: 'microloop', group: 1, lvlDef: 0, params: { dry: 0, mode: 2, mix: 0.72 } },
      POST('post', dB(1.5)),
    ] },
    controls: [
      K('lvl', 'LEVEL', { def: 0.5, virtual: true }), K('w.x.feedback', 'REPEATS', { def: 0.45, max: 1 }), K('w.x.time', 'SIZE', { min: 50, max: 6000, def: 420, curve: 'log', display: ms }),
      K('mod', 'MODIFY', { def: 0.5, virtual: true }), K('spread', 'SPREAD', { def: 0, virtual: true }), K('scan', 'SCAN', { def: 0, virtual: true }),
      TOG('bank', 'MODIFIER', ['1', '2', '3'], { virtual: true, col: 0 }), TOG('rt', 'ROUTING', ['IN', 'OUT', 'FEED'], { virtual: true, def: 1, col: 2 }),
      FOOT({ label: 'TAP · SCAN', cb: { tap: (c) => tapTime(c, 'w.x.time', 50, 6000), hold: (c) => c.set('scanH', 1), release: (c) => c.set('scanH', 0) } }),
      FOOT({ label: 'BYPASS · LOOP', cb: { tap: 'bypass', hold: (c) => c.ev('w', 2, 1), release: (c) => c.ev('w', 2, 0) } }),
      LED({ bind: 'tap:w.x.time', color: '#f2d27a' }), bypassLed(),
      K('scanH', 'SCAN HOLD', { def: 0, virtual: true, hidden: true }),
    ],
    dips: ['MANUAL', 'COLLECT', { p: 'dk', l: 'DRY KILL' }, 'ALWAYS', 'LATCH', { p: 'wipe', l: 'WIPE' }, 'BOUNCE', 'SHAPE'],
    presets: [{ bank: 1, mod: 0.85, 'w.x.feedback': 0.7, spread: 0.4 }, { bank: 2, mod: 0.15, scan: 0.6 }],
    derive: (p) => {
      const lvl = p.lvl ?? 0.5, a = ((p.mod ?? 0.5) - 0.5) * 2 * ((p.rt ?? 1) === 0 ? 1.2 : 1), bank = p.bank | 0, sp = p.spread ?? 0, sc = p.scanH ? 1 : p.scan ?? 0, A = Math.min(1, Math.abs(a));
      return {
        'd.lvl': p.dk ? 0 : 2, 'w.lvl': p.wipe ? 0 : 2 * lvl * 1.2, 'sc.lvl': 2 * sc, 'sc.length': 0.3 + 2.7 * sc,
        'w.x.mode': sp < 0.05 ? 0 : 2, 'w.x.heads': sp < 0.5 ? 6 : 7, 'w.x.spread': 0.3 + 0.6 * sp,
        'w.x.feedback': clamp((p['w.x.feedback'] ?? 0.45) + ((p.rt ?? 1) === 2 ? 0.08 : 0), 0, 1.02),
        'w.mf.on': bank === 0 && A > 0.04 ? 1 : 0, 'w.mf.filter': a < 0 ? 0 : 2, 'w.mf.pos': a < 0 ? 1 - A * 0.85 : A * 0.8,
        'w.mp.on': bank === 1 && A > 0.04 ? 1 : 0, 'w.mp.semis1': a < 0 ? -12 : 12, 'w.mp.level1': A, 'w.mp.dry': 1 - A,
        'w.ms.on': bank === 2 && A > 0.04 ? 1 : 0, 'w.ms.depth': A, 'w.ms.pattern': a < 0 ? 5 : 11,
      };
    },
    desc: 'Echo with a memory: LEVEL / REPEATS / SIZE (50 ms – 6 s) set the echo, SPREAD adds a second tap behind it, SCAN plays moments back out of the recent past. MODIFY applies modifier bank 1 (filter), 2 (octave) or 3 (stutter) to the echoes, noon neutral. Left: tap tempo, hold = momentary scan; right: bypass, hold = loop the echoes. DIPs DRY KILL and WIPE work.',
  }));

  // ================================================================== codec / tape degradation
  add(CB({
    id: 'cba.lossy', name: 'Leaky', ref: 'Chase Bliss Lossy (with Goodhertz)', code: 'LEAKY', logo: 'leaky', logoFont: "'Share Tech Mono', monospace", logoSize: 18, logoLs: 3,
    typeName: 'Codec damage', cat: 'Filter', art: 'pixels', size: 'mk2', color: '#dfe7ea', text: '#13212b', palette: ['#ff5c8a', '#3fb6ff', '#ffd23f', '#7a5cff'],
    algo: 'chain', cost: 2.2,
    opts: { chain: [{ prefix: 'f', algo: 'pareq', params: { spectrum: 0, b1g: 0, b2g: 0, b3g: 0, b4g: 0, b5g: 0, b6g: 0 } }, { prefix: 'l', algo: 'lossy' }] },
    controls: [
      K('glob', 'GLOBAL', { def: 0.65, virtual: true }), K('l.verb', 'VERB', { def: 0.15 }), K('speed', 'SPEED', { def: 0.4, virtual: true }),
      K('loss', 'LOSS', { def: 0.45, virtual: true }), K('filt', 'FILTER', { def: 0, virtual: true }), K('freq', 'FREQ', { def: 0.5, virtual: true, display: (v) => Math.round(lmap(v, 120, 8000)) + ' Hz' }),
      TOG('slope', 'SLOPE', ['6dB', '24dB', '96dB'], { virtual: true, def: 1 }), TOG('pk', 'PACKETS', ['RPT', 'CLEAN', 'LOSS'], { virtual: true, def: 1 }), TOG('lm', 'MODE', ['INV', 'STD', 'JITR'], { virtual: true, def: 1 }),
      FOOT({ label: 'BYPASS · GATE', cb: { tap: 'bypass', hold: (c) => c.set('gateH', 1), release: (c) => c.set('gateH', 0) } }),
      FOOT({ action: 'toggle', p: 'l.freeze', label: 'FREEZE' }),
      bypassLed(), LED({ bind: 'onparam:l.freeze', color: '#3fb6ff' }),
      K('gateH', 'GATE HOLD', { def: 0, virtual: true, hidden: true }),
    ],
    dips: ['MISO', 'SPREAD', 'TRAILS', 'LATCH', 'PRE/POST', { p: 'slow', l: 'SLOW' }, 'INVERT', { p: 'aw', l: 'ALL WET' }],
    presets: [{ loss: 0.8, pk: 2, speed: 0.7 }, { filt: 0.7, freq: 0.6, lm: 2, 'l.verb': 0.5 }],
    derive: (p) => {
      const g = p.glob ?? 0.65, f = p.filt ?? 0, c = lmap(p.freq ?? 0.5, 120, 8000), hw = lerp(5, 0.4, f), sl = [0, 1, 3][p.slope ?? 1], sp = (p.speed ?? 0.4) * (p.slow ? 0.4 : 1), pk = p.pk ?? 1;
      return {
        'f.hpon': f > 0.02 ? 1 : 0, 'f.lpon': f > 0.02 ? 1 : 0, 'f.hpf': clamp(c / Math.pow(2, hw), 20, 2000), 'f.lpf': clamp(c * Math.pow(2, hw), 500, 20000), 'f.hps': sl, 'f.lps': sl,
        'l.mix': p.aw ? 1 : 0.35 + 0.65 * g, 'l.loss': c01((p.loss ?? 0.45) * (0.4 + 0.6 * g)), 'l.filter': 0.95,
        'l.mode': [1, 0, 2][p.lm ?? 1], 'l.packets': pk === 1 ? 0 : (0.15 + 0.6 * sp) * (pk === 0 ? 0.7 : 1), 'l.gate': p.gateH ? 0.6 : 0,
      };
    },
    desc: 'Low-bitrate streaming damage: LOSS removes and quantises spectral detail (standard, inverse = only what the codec throws away, or jitter), PACKETS drops (LOSS) or repeats (RPT) frames at SPEED, FILTER + FREQ + SLOPE band-limit the signal, VERB smears it into a codec reverb. GLOBAL is the overall intensity. FREEZE holds the current frame; hold BYPASS to gate.',
  }));

  const TAPES = [
    { hp: 40, lp: 15000, mf: 1000, md: 0 }, { hp: 80, lp: 9000, mf: 2500, md: 2 }, { hp: 120, lp: 6000, mf: 1200, md: -2 }, { hp: 200, lp: 4500, mf: 900, md: 3 },
    { hp: 60, lp: 11000, mf: 300, md: 3 }, { hp: 300, lp: 3500, mf: 1500, md: 4 }, { hp: 150, lp: 7000, mf: 3000, md: -3 }, { hp: 90, lp: 12000, mf: 600, md: -1 },
  ];
  add(CB({
    id: 'cba.genloss2', name: 'Dub Loss MKII', ref: 'Chase Bliss Generation Loss MKII', code: 'DUB LOSS', logo: 'DUB LOSS', logoFont: "'Oswald', sans-serif", logoSize: 15, logoLs: 3,
    typeName: 'Tape / VHS degradation', cat: 'Modulation', art: 'vhs', size: 'mk2', color: '#25221f', text: '#efe8da', palette: ['#e8463c', '#f39a2e', '#f5d43a', '#45b36b', '#3c7fd6'],
    algo: 'chain', cost: 1.4,
    opts: { mix: true, chain: [
      { prefix: 't', algo: 'lofi', params: { mode: 0, mix: 1 } },
      { prefix: 'm', algo: 'pareq', params: { spectrum: 0, hpon: 1, lpon: 1, b1g: 0, b2g: 0, b4g: 0, b5g: 0, b6g: 0 } },
      { prefix: 'sl', algo: 'slicer', on: false, params: { pattern: 14, smooth: 0.6 } },
      { prefix: 'ps', algo: 'pitch', on: false, params: { dry: 0, level1: 1, semis1: -24, glide: 0.95 } },
    ] },
    controls: [
      K('t.wow', 'WOW', { def: 0.3 }), K('vol', 'VOLUME', { def: 0.5, virtual: true }), K('model', 'MODEL', { def: 0.15, virtual: true, display: (v) => 'model ' + (Math.round(v * 7) + 1) }),
      K('t.flutter', 'FLUTTER', { def: 0.25 }), K('t.saturate', 'SATURATE', { def: 0.3 }), K('fail', 'FAILURE', { def: 0.15, virtual: true }),
      TOG('ax', 'AUX', ['STOP', 'FILT', 'FAIL'], { virtual: true }), TOG('nz', 'NOISE', ['NONE', 'MILD', 'HVY'], { virtual: true, def: 1 }), TOG('dr', 'DRY', ['NONE', 'SMALL', 'UNITY'], { virtual: true }),
      FOOT({ label: 'AUX', cb: { down: (c) => c.set('aux', 1), up: (c) => c.set('aux', 0), tap: () => {} } }), FOOT({ label: 'BYPASS', cb: { tap: 'bypass' } }),
      LED({ bind: 'onparam:aux', color: '#ffb02e' }), bypassLed(),
      K('aux', 'AUX HELD', { def: 0, virtual: true, hidden: true }),
    ],
    dips: ['MISO', 'SPREAD', 'DRY TYPE', { p: 'nodrop', l: 'DROP BYP' }, 'SNAG BYP', { p: 'nohum', l: 'HUM BYP' }, 'BOUNCE', 'SWEEP'],
    presets: [{ model: 0.7, 't.wow': 0.6, fail: 0.4 }, { model: 0.3, nz: 2, 't.saturate': 0.7 }],
    derive: (p) => {
      const T = TAPES[Math.round(c01(p.model ?? 0.15) * 7)], aux = (p.aux ?? 0) > 0.5, ax = p.ax | 0, v = p.vol ?? 0.5;
      const f = aux && ax === 2 ? 1 : p.fail ?? 0.15;
      return {
        mix: [1, 0.8, 0.5][p.dr | 0],
        't.level': (v >= 0.5 ? (v - 0.5) * 12 : -30 * (1 - 2 * v)) - 4, 't.age': 0.15 + 0.7 * f, 't.noise': p.nohum ? 0 : [0, 0.22, 0.55][p.nz ?? 1],
        'm.on': aux && ax === 1 ? 0 : 1, 'm.hpf': T.hp, 'm.lpf': T.lp, 'm.b3f': T.mf, 'm.b3g': T.md,
        'sl.on': !p.nodrop && f > 0.3 ? 1 : 0, 'sl.depth': (f - 0.3) * 0.9,
        'ps.on': aux && ax === 0 ? 1 : 0,
      };
    },
    desc: 'Cassette / VHS machine: WOW and FLUTTER pitch drift, SATURATE magnetic saturation, FAILURE malfunctions (age and volume dropouts), MODEL picks one of eight tape-deck EQ profiles. NOISE adds hiss, DRY blends some clean signal back. Hold AUX for the performance effect: tape STOP, FILTER (model off) or FAIL. DIPs DROP BYP and HUM BYP work.',
  }));

  // ================================================================== multidirectional delay / multi-modulator
  add(CB({
    id: 'cba.rmc', name: 'Inverse Mode B', ref: 'Chase Bliss Reverse Mode C', code: 'INVERSE B', logo: 'INVERSE MODE B', logoFont: "'Oswald', sans-serif", logoSize: 11, logoLs: 2,
    typeName: 'Multidirectional delay', cat: 'Delay', art: 'mirror', size: 'rmc', rows: [4, 4], kr: 9.5, color: '#e9dcc0', text: '#3a2918', palette: ['#c2462e', '#2f6f8f', '#3a2918'],
    algo: 'chain', cost: 2.6,
    opts: { chain: [
      DRY('d', 1),
      ...['fw', 'rv'].map((k) => WET(k, 'delay', { group: 1, opts: { maxMs: 8400 }, params: { mix: 0.72, mode: k === 'fw' ? 0 : 5, feedback: 0.35 }, post: [
        { prefix: 'vb', algo: 'chorus', on: false, params: { mode: 1, mix: 1 } },
        { prefix: 'tr', algo: 'tremolo', on: false },
        { prefix: 'fs', algo: 'ringmod', on: false, params: { mix: 0.5 } },
      ] })),
      POST('post', dB(1.5)),
    ] },
    controls: [
      K('fw.x.time', 'TIME', { min: 20, max: 4200, def: 420, curve: 'log', display: ms }), K('off', 'OFFSET', { def: 0.5, virtual: true }), K('mix', 'MIX', { def: 0.45, virtual: true }), K('fb', 'FEEDBACK', { def: 0.35, virtual: true }),
      K('filt', 'FILTER', { def: 0.6, virtual: true }), K('bal', 'BALANCE', { def: 0.6, virtual: true }), K('depth', 'DEPTH', { def: 0.3, virtual: true }), K('rate', 'RATE', { def: 0.4, virtual: true }),
      TOG('ms', 'MOD', ['SYNC', 'OFF', 'FREE'], { virtual: true, def: 1 }), TOG('mt', 'TYPE', ['VIB', 'TREM', 'FREQ'], { virtual: true }), TOG('sq', 'SEQUENCE', ['RUN', 'OFF', 'ENV'], { virtual: true, def: 1 }),
      FOOT({ label: 'ON · HALF', cb: { tap: 'bypass', hold: (c) => c.toggle('half'), holdMs: 900 } }),
      FOOT({ label: 'TAP · HOLD', cb: { tap: (c) => tapTime(c, 'fw.x.time', 20, 4200), hold: (c) => { c.ev('fw', 2, 1); c.ev('rv', 2, 1); }, release: (c) => { c.ev('fw', 2, 0); c.ev('rv', 2, 0); } } }),
      bypassLed(), LED({ bind: 'tap:fw.x.time', color: '#2f9fd8' }),
      K('half', 'HALF RATE', { def: 0, virtual: true, hidden: true }),
    ],
    dips: [{ p: 'swap', l: 'SWAP' }, 'MISO', { p: 'spread', l: 'SPREAD' }, 'TRAILS', 'LATCH', 'FEED TYPE', 'FADE TYPE', 'MOD TYPE'],
    presets: [{ bal: 1, fb: 0.6, ms: 2, mt: 0, depth: 0.5 }, { bal: 0.5, off: 0.8, sq: 0, ms: 0, mt: 2 }],
    derive: (p) => {
      const half = (p.half ?? 0) > 0.5, t = (p['fw.x.time'] ?? 420) * (half ? 2 : 1), mix = p.mix ?? 0.45, bal = p.swap ? 1 - (p.bal ?? 0.6) : p.bal ?? 0.6, fb = p.fb ?? 0.35;
      const tone = 0.15 + 0.85 * (p.filt ?? 0.6) * (half ? 0.7 : 1), ms = p.ms ?? 1, mt = p.mt | 0, sq = p.sq ?? 1, dep = p.depth ?? 0.3;
      const hz = ms === 0 ? 1000 / t : lmap(p.rate ?? 0.4, 0.1, 12);
      const o = { 'd.lvl': dn(mix), 'fw.lvl': up(mix) * Math.min(1, 2 * (1 - bal)), 'rv.lvl': up(mix) * Math.min(1, 2 * bal) };
      for (const k of ['fw', 'rv']) Object.assign(o, {
        [k + '.x.feedback']: fb, [k + '.x.tone']: tone, [k + '.x.spread']: p.spread ? 0.9 : 0.4,
        [k + '.vb.on']: ms !== 1 && mt === 0 ? 1 : 0, [k + '.vb.rate']: rateT(hz, 0.06, 9), [k + '.vb.depth']: dep,
        [k + '.tr.on']: ms !== 1 && mt === 1 ? 1 : 0, [k + '.tr.rate']: rateT(hz, 0.4, 14), [k + '.tr.depth']: dep,
        [k + '.fs.on']: ms !== 1 && mt === 2 ? 1 : 0, [k + '.fs.freq']: c01(0.1 + 0.5 * (p.rate ?? 0.4)), [k + '.fs.mix']: dep,
      });
      o['fw.x.time'] = clamp(t, 20, 8400);
      o['rv.x.time'] = clamp(t * lmap(p.off ?? 0.5, 0.5, 2), 20, 8400);
      o['fw.x.mode'] = half ? 3 : sq === 0 ? 7 : sq === 2 ? 1 : 0;
      return o;
    },
    desc: 'Forward and reverse echo voices (BALANCE blends them, OFFSET moves the reverse voice\'s time against the forward one) with audio-rate modulation on the echoes: vibrato, tremolo or frequency-shift style ring mod, synced to the delay time or free. SEQUENCE RUN rolls the forward voice across the stereo field. Hold the left switch to halve the sample rate (double time, lo-fi); right: tap tempo, hold = capture and repeat.',
  }));

  add(CB({
    id: 'cba.lostfound', name: 'Odds + Ends', ref: 'Chase Bliss Lost + Found', code: 'ODDS + ENDS', logo: 'ODDS + ENDS', logoFont: "'Oswald', sans-serif", logoSize: 13, logoLs: 2,
    typeName: 'Stereo multi-modulator', cat: 'Multi-FX', kind: 'Pedal', art: 'objects', size: 'mk2', color: '#e6dcc4', text: '#2c2418', palette: ['#c8553d', '#f2a541', '#3e7c8c', '#5b4b8a', '#2c2418'],
    algo: 'chain', cost: 4.5,
    opts: { chain: [
      DRY('d1', 1),
      WET('lr', 'reverb', { group: 1, params: { mix: 0.67, mode: 6 } }),
      { prefix: 'lp', algo: 'pitch', group: 1, lvlDef: 0, params: { dry: 0, level1: 0.8, level2: 0.5, semis1: 12, semis2: 7 } },
      { prefix: 'lph', algo: 'phaser', group: 1, lvlDef: 0, opts: { stages: 6 }, params: { mix: 1 } },
      { prefix: 'lls', algo: 'lossy', group: 1, lvlDef: 0, params: { mix: 1, mode: 2 } },
      POST('p1', dB(2.5)),
      DRY('d2', 2),
      WET('rd', 'delay', { group: 2, opts: { maxMs: 1500 }, params: { mix: 0.72, mode: 2, heads: 4 } }),
      { prefix: 'rg', algo: 'microloop', group: 2, lvlDef: 0, params: { dry: 0, mode: 2, mix: 0.72 } },
      { prefix: 'rs', algo: 'synth', group: 2, lvlDef: 0, params: { dry: 0, wet: 0.7, mode: 0, level: -6 } },
      { prefix: 'rr', algo: 'flanger', group: 2, lvlDef: 0, params: { mix: 1, speed: 0, width: 0.05 } },
      { prefix: 're', algo: 'chorus', group: 2, lvlDef: 0, params: { mode: 2, mix: 1 } },
      { prefix: 'rl', algo: 'lofi', group: 2, lvlDef: 0, params: { mode: 0, mix: 1 } },
      POST('p2', dB(3.5)),
    ] },
    controls: [
      K('lt', 'L TIME', { def: 0.5, virtual: true }), K('mix', 'MIX', { def: 0.45, virtual: true }), K('rt2', 'R TIME', { def: 0.45, virtual: true }),
      K('lm', 'L MODIFY', { def: 0.3, virtual: true }), K('blend', 'BLEND', { def: 0.5, virtual: true }), K('rm', 'R MODIFY', { def: 0.3, virtual: true }),
      TOG('lfx', 'LEFT', ['VERB', 'PITCH', 'WARP'], { virtual: true }), TOG('route', 'ROUTING', ['L>R', 'L+R', 'R>L'], { virtual: true }), TOG('rfx', 'RIGHT', ['DELAY', 'SYNTH', 'BEND'], { virtual: true }),
      FOOT({ label: 'LEFT', cb: { tap: (c) => c.toggle('lOn'), hold: (c) => (c.ui.lfx | 0) === 0 && c.ev('lr', 2, 1), release: (c) => (c.ui.lfx | 0) === 0 && c.ev('lr', 2, 0) } }),
      FOOT({ label: 'RIGHT', cb: { tap: (c) => c.toggle('rOn'), hold: (c) => (c.ui.rfx | 0) === 0 && c.ev('rd', 2, 1), release: (c) => (c.ui.rfx | 0) === 0 && c.ev('rd', 2, 0) } }),
      LED({ bind: 'onparam:lOn', color: '#ff3324' }), LED({ bind: 'onparam:rOn', color: '#ff3324' }),
      K('lOn', 'LEFT ON', { def: 1, virtual: true, hidden: true }), K('rOn', 'RIGHT ON', { def: 1, virtual: true, hidden: true }),
    ],
    dips: ['MISO', 'SPREAD', 'LATCH', { p: 'lswap', l: 'L SWAP' }, { p: 'rswap', l: 'R SWAP' }, 'UNSYNC', 'TRAILS', 'BANK'],
    presets: [{ lfx: 1, lm: 0.2, rfx: 2, rm: 0.8 }, { lfx: 2, lm: 0.8, rfx: 1, rm: 0.2 }],
    derive: (p) => {
      const mix = p.mix ?? 0.45, bl = p.blend ?? 0.5, rtg = p.route | 0;
      let lfx = p.lfx | 0, rfx = p.rfx | 0;
      const L = (p.lOn ?? 1) > 0.5, R = (p.rOn ?? 1) > 0.5;
      const lt = p.lt ?? 0.5, rt = p.rt2 ?? 0.45, lmB = (p.lm ?? 0.3) > 0.5, rmB = (p.rm ?? 0.3) > 0.5, li = Math.abs((p.lm ?? 0.3) - 0.5) * 2, ri = Math.abs((p.rm ?? 0.3) - 0.5) * 2;
      const wl = L ? up(mix) * Math.min(1, 2 * (rtg === 2 ? bl : 1 - bl)) : 0, wr = R ? up(mix) * Math.min(1, 2 * (rtg === 2 ? 1 - bl : bl)) : 0;
      const lane = (n, on) => (on ? 1 : 0);
      const o = { 'd1.lvl': dn(mix), 'd2.lvl': 2 };
      const lsel = p.rswap ? null : lfx, rsel = p.lswap ? null : rfx;
      o['lr.lvl'] = wl * lane(0, lsel === 0); o['lp.lvl'] = wl * lane(1, lsel === 1); o['lph.lvl'] = wl * lane(2, lsel === 2 && !lmB); o['lls.lvl'] = wl * lane(2, lsel === 2 && lmB);
      o['rd.lvl'] = wr * (rsel === 0 && !rmB ? 1 : 0); o['rg.lvl'] = wr * (rsel === 0 && rmB ? 1 : 0); o['rs.lvl'] = wr * (rsel === 1 && !rmB ? 1 : 0);
      o['rr.lvl'] = wr * (rsel === 1 && rmB ? 1 : 0); o['re.lvl'] = wr * (rsel === 2 && !rmB ? 1 : 0); o['rl.lvl'] = wr * (rsel === 2 && rmB ? 1 : 0);
      Object.assign(o, {
        'lr.x.mode': lmB ? 1 : 6, 'lr.x.decay': 0.4 + 0.58 * lt, 'lr.x.mod': lmB ? 0.1 : 0.35 + 0.6 * li, 'lr.x.diffusion': 0.5 + 0.4 * li,
        'lp.semis1': lmB ? Math.round(lerp(-12, 12, lt)) : 12, 'lp.semis2': lmB ? 0 : 7, 'lp.level2': lmB ? 0 : 0.3 + 0.5 * li, 'lp.glide': lmB ? 0.05 : 0.6,
        'lph.rate': lt, 'lph.feedback': 0.5 + 0.4 * li, 'lph.stages': Math.round(lerp(2, 12, lt)),
        'lls.loss': 0.3 + 0.6 * li, 'lls.verb': lt * 0.6,
        'rd.x.time': lmap(rt, 60, 1400), 'rd.x.feedback': 0.25 + 0.6 * ri,
        'rg.length': lmap(rt, 0.05, 1), 'rg.stretch': ri,
        'rs.attack': 0.05, 'rs.decay': 0.15 + 0.7 * rt, 'rs.filter': 0.3 + 0.6 * ri,
        'rr.manual': rt, 'rr.regen': 0.7 + 0.28 * ri,
        're.rate': rt * 0.6, 're.depth': 0.3 + 0.6 * ri,
        'rl.wow': 0.2 + 0.7 * ri, 'rl.flutter': 0.2 + 0.5 * rt, 'rl.age': 0.3 + 0.5 * ri,
      });
      return o;
    },
    desc: 'Two channels of oddities. LEFT: reverb (slow-verb / useful ambience), pitch (orchestral swell / pitch repeater) or warp (pinging phaser / spectral modulator). RIGHT: delay (tape echo / grain tumbler), synth (impulse synth / sympathetic resonator) or bend (ensemble expander / tape lite). MODIFY picks variant A (left of noon) or B and its intensity; TIME is mode-specific. Footswitches engage each side, hold for freeze / infinite repeats.',
  }));

  // ================================================================== desktop motorised-fader units
  add(CB({
    id: 'cba.cxm1978', name: 'DXR 1979', ref: 'Chase Bliss CXM 1978 (with Meris)', code: 'DXR 1979', logo: 'DXR 1979', logoFont: "'Oswald', sans-serif", logoSize: 16,
    typeName: 'Studio reverb', cat: 'Reverb', form: 'chase-desk', color: '#ece3cf', side: '#3a2a20', text: '#22201c', stripe: '#c8402f', cap: '#20201f', capLine: '#f2ede2',
    algo: 'chain', cost: 2.2, stereo: 'stereo', ports: STEREO,
    opts: { chain: [DRY('d', 1), WET('w', 'reverb', { group: 1, lvl: 0.9, params: { mix: 0.67 }, post: [{ prefix: 'c', algo: 'crusher', on: false, params: { mix: 1 } }] })] },
    controls: [
      SEL('rtype', 'TYPE', ['ROOM', 'PLATE', 'HALL'], { virtual: true, hidden: true, def: 1 }),
      SEL('diff', 'DIFFUSION', ['LOW', 'MED', 'HIGH'], { virtual: true, hidden: true, def: 1 }),
      SEL('tank', 'TANK MOD', ['LOW', 'MED', 'HIGH'], { virtual: true, hidden: true, def: 0 }),
      SEL('clock', 'CLOCK', ['HIFI', 'STD', 'LOFI'], { virtual: true, hidden: true, def: 1 }),
      SCREEN('chase-cycle', { label: 'TYPE', param: 'rtype', opts: ['ROOM', 'PLATE', 'HALL'], def: 1 }),
      SCREEN('chase-cycle', { label: 'DIFFUSION', param: 'diff', opts: ['LOW', 'MED', 'HIGH'], def: 1 }),
      SCREEN('chase-cycle', { label: 'TANK MOD', param: 'tank', opts: ['LOW', 'MED', 'HIGH'], def: 0 }),
      SCREEN('chase-cycle', { label: 'CLOCK', param: 'clock', opts: ['HIFI', 'STD', 'LOFI'], def: 1 }),
      SLIDER('bass', 'BASS', { def: 0.55, virtual: true }), SLIDER('mids', 'MIDS', { def: 0.5, virtual: true }), SLIDER('cross', 'CROSS', { def: 0.4, virtual: true }),
      SLIDER('treble', 'TREBLE', { def: 0.6, virtual: true }), SLIDER('mix', 'MIX', { def: 0.35, virtual: true }), SLIDER('pre', 'PRE-DLY', { def: 0.1, virtual: true }),
      FOOT({ action: 'favorite', label: 'PRESET' }), FOOT({ label: 'BYPASS' }),
      LED({ bind: 'fav', color: '#3ddc84' }), bypassLed(),
    ],
    derive: (p) => {
      const b = p.bass ?? 0.55, m = p.mids ?? 0.5, cr = p.cross ?? 0.4, tr = p.treble ?? 0.6, mix = p.mix ?? 0.35, ck = p.clock ?? 1, rt = p.rtype ?? 1;
      const preMax = [42, 168, 500][ck];
      return {
        'd.lvl': dn(mix), 'w.lvl': up(mix) * 0.9,
        'w.x.mode': [0, 2, 1][rt], 'w.x.size': [0.35, 0.6, 0.9][rt], 'w.x.decay': 0.25 + 0.72 * m,
        'w.x.lowdamp': c01(0.5 + (m - b) * (0.4 + 0.6 * cr)), 'w.x.highdamp': 1 - tr, 'w.x.tone': (0.3 + 0.7 * tr) * (ck === 1 ? 0.88 : 1),
        'w.x.diffusion': [0.4, 0.7, 0.95][p.diff ?? 1], 'w.x.mod': [0.1, 0.35, 0.75][p.tank | 0], 'w.x.ensemble': (p.tank | 0) === 2 ? 0.4 : 0,
        'w.x.predelay': (p.pre ?? 0.1) * preMax,
        'w.c.on': ck === 2 ? 1 : 0, 'w.c.bits': 0.62, 'w.c.rate': c01(0.8 - 0.65 * (p.pre ?? 0.1)),
      };
    },
    desc: 'Desktop studio reverb with six motorised-style faders: BASS and MIDS decay either side of the CROSS-over, TREBLE damping, MIX and PRE-DLY. Arcade buttons cycle TYPE (room / plate / hall), DIFFUSION, TANK MOD and CLOCK (HIFI, standard or LOFI, where PRE-DLY also lowers the sample rate). PRESET recalls a favourite (hold to store).',
  }));

  const BT_MODES = ['MOD', 'SHORT', 'LONG', 'LOOP'], BT_RANGE = [[10, 46], [46, 736], [736, 12000], [200, 12000]];
  add(CB({
    id: 'cba.bigtime', name: 'Long Haul', ref: 'Chase Bliss Big Time (with EAE)', code: 'LONG HAUL', logo: 'LONG HAUL', logoFont: "'Oswald', sans-serif", logoSize: 17, logoColor: '#ffb347',
    typeName: 'Analog / digital echo', cat: 'Delay', form: 'chase-desk', deskW: 290, deskH: 262, color: '#1f2227', side: '#111214', text: '#e9e3d2', stripe: '#ffb347', cap: '#e9e3d2', capLine: '#1f2227',
    algo: 'chain', cost: 2.4, stereo: 'stereo', ports: STEREO,
    opts: { chain: [
      { prefix: 'pre', algo: 'drive', opts: { clip: 'tube', tone: 'none', gainMinDb: 0, gainMaxDb: 20 } },
      DRY('d', 1),
      WET('w', 'delay', { group: 1, lvl: 1, opts: { maxMs: 12000, defaultMs: 450 }, params: { mix: 0.72 }, post: [
        { prefix: 'tl', algo: 'peq' }, { prefix: 'lim', algo: 'comp', opts: { type: 'vca' } },
      ] }),
    ] },
    controls: [
      SCREEN('chase-lcd', { text: (u) => [BT_MODES[u.btmode ?? 1] + (u.scale ? ' ♪' : ''), Math.round(u['w.x.time'] ?? 450) + ' MS'] }),
      SEL('scale', 'SCALE', ['FREE', 'STEP'], { virtual: true, hidden: true }), SEL('motion', 'MOTION', ['OFF', 'SLOW', 'FAST'], { virtual: true, hidden: true }),
      SEL('btmode', 'MODE', BT_MODES, { virtual: true, hidden: true, def: 1 }), SEL('voicing', 'VOICING', ['BRT', 'WARM', 'DARK'], { virtual: true, hidden: true, def: 1 }),
      SEL('state', 'STATE', ['CLEAN', 'COMP', 'SQSH'], { virtual: true, hidden: true, def: 1 }),
      SCREEN('chase-cycle', { label: 'SCALE', param: 'scale', opts: ['FREE', 'STEP'], led: '#ffb347', cap: '#2b2e34' }),
      SCREEN('chase-cycle', { label: 'MOTION', param: 'motion', opts: ['OFF', 'SLOW', 'FAST'], led: '#ffb347', cap: '#2b2e34' }),
      SCREEN('chase-cycle', { label: 'MODE', param: 'btmode', opts: ['MOD', 'SHRT', 'LONG', 'LOOP'], def: 1, led: '#ffb347', cap: '#2b2e34' }),
      SCREEN('chase-cycle', { label: 'VOICING', param: 'voicing', opts: ['BRT', 'WARM', 'DARK'], def: 1, led: '#ffb347', cap: '#2b2e34' }),
      SCREEN('chase-cycle', { label: 'STATE', param: 'state', opts: ['CLEAN', 'COMP', 'SQSH'], def: 1, led: '#ffb347', cap: '#2b2e34' }),
      SLIDER('color', 'COLOR', { def: 0.25, virtual: true }), SLIDER('w.x.time', 'TIME', { min: 10, max: 12000, def: 450, curve: 'log', display: ms }), SLIDER('cluster', 'CLUSTER', { def: 0, virtual: true }),
      SLIDER('tilt', 'TILT EQ', { def: 0.5, virtual: true }), SLIDER('w.x.feedback', 'FEEDBACK', { def: 0.4, max: 1.05 }), SLIDER('wet', 'WET', { def: 0.4, virtual: true }),
      FOOT({ label: 'TAP', cb: { tap: (c) => { const r = BT_RANGE[c.ui.btmode ?? 1]; tapTime(c, 'w.x.time', r[0], Math.min(r[1], 3000)); } } }),
      FOOT({ label: 'BYPASS · HOLD', cb: { tap: 'bypass', hold: (c) => c.ev('w', 2, 1), release: (c) => c.ev('w', 2, 0) } }),
      LED({ bind: 'tap:w.x.time', color: '#ffb347' }), bypassLed(),
    ],
    ctrl: { ins: [{ label: 'EXP', param: 'w.x.feedback', min: 0, max: 1.05 }] },
    derive: (p) => {
      const md = p.btmode ?? 1, r = BT_RANGE[md], cl = p.cluster ?? 0, mo = p.motion | 0, tilt = (p.tilt ?? 0.5) - 0.5, st = p.state ?? 1, wet = p.wet ?? 0.4;
      let t = clamp(p['w.x.time'] ?? 450, r[0], r[1]);
      if (p.scale) t = clamp(125 * Math.pow(2, Math.round(Math.log2(t / 125) * 2) / 2), r[0], r[1]);
      return {
        'pre.gain': (p.color ?? 0.25) * 0.8, 'pre.level': 0.62,
        'd.lvl': 2, 'w.lvl': 2 * Math.min(1, wet * 1.6),
        'w.x.time': t, 'w.x.feedback': md === 3 ? 1 : p['w.x.feedback'] ?? 0.4,
        'w.x.mode': cl > 0.08 ? 2 : md === 0 || mo ? 4 : md === 2 ? 1 : 0, 'w.x.heads': cl < 0.4 ? 6 : cl < 0.75 ? 5 : 7, 'w.x.spread': 0.3 + 0.6 * cl, 'w.x.age': 0.05,
        'w.x.moddepth': md === 0 ? 0.5 : [0, 0.25, 0.4][mo], 'w.x.modrate': [0.2, 0.2, 0.65][mo],
        'w.x.tone': [0.85, 0.6, 0.38][p.voicing ?? 1], 'w.x.lowcut': [0.15, 0.05, 0][p.voicing ?? 1],
        'w.tl.lowfreq': 250, 'w.tl.lowgain': -tilt * 12, 'w.tl.highfreq': 2500, 'w.tl.highgain': tilt * 12,
        'w.lim.on': st ? 1 : 0, 'w.lim.sustain': [0.2, 0.45, 0.85][st], 'w.lim.ratio': [0.3, 0.6, 0.95][st], 'w.lim.level': 0.5,
      };
    },
    desc: 'Hybrid rack-style echo: analog-flavoured preamp (COLOR) into a 12-second digital delay with a limiter on the repeats (STATE). MODE picks the range (MOD 3–46 ms for chorus / flange, SHORT, LONG, LOOP = infinite repeats), CLUSTER spreads the echo into diffused multi-taps, MOTION adds modulation, SCALE snaps TIME to musical steps, VOICING and TILT EQ shape the repeats. Left: tap tempo, right: bypass (hold = freeze the repeats).',
  }));

  tz.addDefs(defs);
}
