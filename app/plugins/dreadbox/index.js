// Built-in Tone Zone plugin: Dreadbox.
// Blocks inspired by Dreadbox effects. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten, ms, MONO, STEREO } = tz.helpers;
  const { svg, label, formKit, noisePattern } = tz.gfx;

  const INK = '#151413', PAPER = '#ebe5d5', RED = '#c3312a';
  // deterministic pseudo-random so the artwork is identical on every render
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---- artwork painters (drawn inside the paper panel, clipped)
  const ART = {
    // sunlight filtering through leaves: red sun, ink branch with leaf clusters, light shafts and dappled spots
    komorebi(g, x, y, w, h) {
      const r = rng(7);
      const sx = x + w - 26, sy = y + 16;
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.58 + i * 0.045);
        svg('path', { d: `M${sx} ${sy} L${sx + Math.cos(a) * 190} ${sy + Math.sin(a) * 190} L${sx + Math.cos(a + 0.018) * 190} ${sy + Math.sin(a + 0.018) * 190} Z`, fill: INK, opacity: 0.07 }, g);
      }
      svg('circle', { cx: sx, cy: sy, r: 13, fill: RED }, g);
      svg('circle', { cx: sx, cy: sy, r: 13, fill: 'none', stroke: INK, 'stroke-opacity': 0.25, 'stroke-width': 0.6 }, g);
      // branch
      const br = `M${x - 4} ${y + 8} C ${x + 30} ${y + 14} ${x + 52} ${y + 4} ${x + 78} ${y + 18} S ${x + 116} ${y + 44} ${x + 128} ${y + 36}`;
      svg('path', { d: br, fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      svg('path', { d: `M${x + 40} ${y + 10} q 8 14 2 30`, fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
      svg('path', { d: `M${x + 92} ${y + 28} q -6 16 4 26`, fill: 'none', stroke: INK, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g);
      const clusters = [[x + 14, y + 12], [x + 34, y + 20], [x + 44, y + 40], [x + 64, y + 12], [x + 84, y + 24], [x + 96, y + 52], [x + 112, y + 38], [x + 124, y + 32]];
      for (const [cx, cy] of clusters)
        for (let i = 0; i < 7; i++) {
          const lx = cx + (r() - 0.5) * 18, ly = cy + (r() - 0.5) * 12, rot = r() * 180;
          svg('ellipse', { cx: lx, cy: ly, rx: 3.6, ry: 1.5, fill: INK, opacity: 0.75 + r() * 0.25, transform: `rotate(${rot.toFixed(0)} ${lx.toFixed(1)} ${ly.toFixed(1)})` }, g);
        }
      // dappled light on the ground
      for (let i = 0; i < 14; i++) svg('ellipse', { cx: x + 10 + r() * (w - 20), cy: y + h - 12 + (r() - 0.5) * 10, rx: 2 + r() * 4, ry: 0.8 + r() * 1.4, fill: INK, opacity: 0.18 }, g);
      svg('path', { d: `M${x} ${y + h - 18} Q ${x + w / 2} ${y + h - 24} ${x + w} ${y + h - 16}`, fill: 'none', stroke: INK, 'stroke-width': 0.8, opacity: 0.5 }, g);
    },
    // hypnotic spiral over seigaiha (wave) pattern
    hypnosis(g, x, y, w, h) {
      const cx = x + 66, cy = y + 42;
      let d = `M${cx} ${cy}`;
      for (let t = 0; t < Math.PI * 8; t += 0.15) d += ` L${(cx + Math.cos(t) * t * 0.78).toFixed(1)} ${(cy + Math.sin(t) * t * 0.78).toFixed(1)}`;
      svg('path', { d, fill: 'none', stroke: INK, 'stroke-width': 1.3 }, g);
      svg('circle', { cx, cy, r: 3, fill: RED }, g);
      const rr = 9;
      for (let row = 0; row < 3; row++)
        for (let col = -1; col < w / (rr * 2) + 1; col++) {
          const wx = x + col * rr * 2 + (row % 2 ? rr : 0), wy = y + 6 + row * 5;
          for (const k of [1, 0.66, 0.33]) svg('path', { d: `M${wx - rr * k} ${wy} A ${rr * k} ${rr * k} 0 0 1 ${wx + rr * k} ${wy}`, fill: k === 1 ? PAPER : 'none', stroke: INK, 'stroke-width': 0.7, opacity: 0.8 }, g);
        }
    },
    // shattered ink: cracks, glitch blocks and a red slash
    disorder(g, x, y, w, h) {
      const r = rng(11);
      svg('path', { d: `M${x + 40} ${y + 6} L${x + 100} ${y + 54}`, stroke: RED, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.9 }, g);
      for (let c = 0; c < 6; c++) {
        let px = x + 30 + r() * 70, py = y + 4 + r() * 10, d = `M${px.toFixed(1)} ${py.toFixed(1)}`;
        for (let i = 0; i < 5; i++) { px += (r() - 0.3) * 12; py += 3 + r() * 6; d += ` L${px.toFixed(1)} ${py.toFixed(1)}`; }
        svg('path', { d, fill: 'none', stroke: INK, 'stroke-width': 0.6 + r() * 1.2, 'stroke-linejoin': 'bevel' }, g);
      }
      for (let i = 0; i < 18; i++) svg('rect', { x: x + 112 + r() * (w - 122), y: y + h - 30 + r() * 22, width: 2 + r() * 10, height: 1 + r() * 3, fill: INK, opacity: 0.5 + r() * 0.5 }, g);
    },
  };

  let seq = 0;
  tz.addForm('dreadbox', (ctx, def) => {
    const g = ctx.g, w = 172, h = 242;
    const id = 'drb' + ++seq;
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 80, [255, 255, 255], 0, 0.06, 1);
    noisePattern(defs, id + 'p', 34, 68, [90, 70, 40], 0, 0.16, 1);
    formKit.body(g, w, h, '#121212', { rx: 7, grain: false });
    svg('rect', { width: w, height: h, rx: 7, fill: `url(#${id}n)` }, g);
    const txt = '#efe9db';
    const theme = { text: txt, knob: 'white', labelSize: 6, labelFont: "'Barlow Condensed', sans-serif", labelLs: 1, toggleTitles: false };
    // paper art panel
    const ax = 8, ay = 142, aw = w - 16, ah = h - ay - 8;
    const cp = svg('clipPath', { id: id + 'c' }, defs);
    svg('rect', { x: ax, y: ay, width: aw, height: ah, rx: 3 }, cp);
    svg('rect', { x: ax, y: ay, width: aw, height: ah, rx: 3, fill: PAPER }, g);
    svg('rect', { x: ax, y: ay, width: aw, height: ah, rx: 3, fill: `url(#${id}p)` }, g);
    const art = svg('g', { 'clip-path': `url(#${id}c)` }, g);
    (ART[def.art] || ART.komorebi)(art, ax, ay, aw, ah);
    svg('rect', { x: ax, y: ay, width: aw, height: ah, rx: 3, fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8 }, g);
    // brush-style logo + hanko seal
    label(g, ax + 10, ay + ah - 21, def.logo, { size: 17, fill: INK, font: "'Oswald', sans-serif", weight: 700, ls: 3.2, anchor: 'start' });
    label(g, ax + 11, ay + ah - 8, (def.typeName || '').toUpperCase(), { size: 4.8, fill: INK, weight: 700, ls: 1.6, anchor: 'start', opacity: 0.8 });
    const hx = ax + 17, hy = ay + 17;
    svg('rect', { x: hx - 9, y: hy - 9, width: 18, height: 18, rx: 2.5, fill: RED, transform: `rotate(-4 ${hx} ${hy})` }, g);
    svg('rect', { x: hx - 7, y: hy - 7, width: 14, height: 14, rx: 1.5, fill: 'none', stroke: PAPER, 'stroke-width': 0.8, transform: `rotate(-4 ${hx} ${hy})` }, g);
    label(g, hx, hy - 2.6, 'T', { size: 6, fill: PAPER, font: "'Oswald', sans-serif", weight: 700 });
    label(g, hx, hy + 3.4, 'Z', { size: 6, fill: PAPER, font: "'Oswald', sans-serif", weight: 700 });
    // top: brand-ish header line
    svg('line', { x1: 14, x2: w - 14, y1: 14, y2: 14, stroke: txt, 'stroke-opacity': 0.35, 'stroke-width': 0.6 }, g);
    formKit.tzBadge(g, w / 2, 9, txt, 3.8);
    const free = (c) => c.x === undefined || c._auto;
    def.controls.forEach((c) => { if (c.x === undefined) c._auto = true; });
    const knobs = def.controls.filter((c) => c.t === 'knob' && free(c));
    const rows = [knobs.slice(0, 3), knobs.slice(3)];
    rows.forEach((r, ri) => r.forEach((k, i) => Object.assign(k, { x: 34 + (i * (w - 68)) / Math.max(1, r.length - 1), y: 38 + ri * 50, r: 12, labelPos: 'below' })));
    const tog = def.controls.filter((c) => c.t === 'toggle' && free(c));
    tog.forEach((t, i) => Object.assign(t, { x: tog.length === 1 ? w / 2 : 46 + i * (w - 92), y: 124, orient: 'h' }));
    def.controls.filter((c) => c.t === 'foot' && free(c)).forEach((f) => Object.assign(f, { style: 'stomp', r: 12, x: w - 44, y: ay + 48 }));
    def.controls.filter((c) => c.t === 'led' && free(c)).forEach((l) => Object.assign(l, { r: 2.6, x: w / 2, y: 124, bezel: '#2a2a2a' }));
    formKit.placeControls(ctx, def.controls, theme);
    return { w, h, theme: Object.assign({}, theme, { jackText: txt }), jacks: formKit.jacksSide(def, w, { flip: ctx.flip, y0: 40, gap: 26 }) };
  });

  const D = (o) => def(Object.assign({ form: 'dreadbox', brand: 'Dreadbox', cost: 0.9 }, o, { controls: [...(o.controls || []), FOOT(), LED({ color: '#ff3b2f' })] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    D({
      id: 'drb.komorebi', name: 'Sunleaf BBD Chorus', ref: 'Dreadbox Komorebi', code: 'SUNLEAF', logo: 'SUNLEAF', typeName: 'BBD chorus / flanger', cat: 'Modulation', art: 'komorebi',
      stereo: 'both', algo: 'chorus',
      controls: [
        k('time', 'TIME', { def: 0.45, virtual: true }), k('feedback', 'FEEDBACK', { def: 0.25 }), k('mix', 'MIX', { def: 0.5 }),
        k('rate', 'RATE', { def: 0.3 }), k('depth', 'DEPTH', { def: 0.55 }), k('tone', 'TONE', { def: 0.55 }),
        TOG('cmode', 'MODE', ['chor', 'flng', 'vibr'], { virtual: true }), TOG('wave', 'LFO', ['tri', 'sine'], { values: [0, 1] }),
      ],
      derive: (p) => {
        const m = p.cmode ?? 0, t = p.time ?? 0.45;
        return { mode: m === 2 ? 1 : 0, delay: m === 1 ? t * 0.18 : 0.2 + t * 0.8, feedback: m === 1 ? Math.min(0.92, 0.2 + (p.feedback ?? 0.25)) : (p.feedback ?? 0.25) * 0.7, mix: m === 2 ? 1 : p.mix ?? 0.5 };
      },
      desc: 'Bucket-brigade chorus with feedback: TIME sets the BBD delay (short = flanger), FEEDBACK adds resonance, LFO picks the wave.',
    }),
    D({
      id: 'drb.hypnosis', name: 'Trance Time Processor', ref: 'Dreadbox Hypnosis', code: 'TRANCE', logo: 'TRANCE', typeName: 'Delay · chorus · spring reverb', cat: 'Delay', art: 'hypnosis', cost: 1.8,
      stereo: 'both', algo: 'chain',
      opts: { chain: [
        { prefix: 'd', algo: 'delay', opts: { maxMs: 1200 } },
        { prefix: 'c', algo: 'chorus', params: { mix: 0.3 } },
        { prefix: 'r', algo: 'reverb', params: { mode: 3 } },
      ] },
      controls: [
        K('d.time', 'TIME', { min: 30, max: 1100, def: 380, display: ms }), k('d.feedback', 'FEEDBACK', { def: 0.35 }), k('d.mix', 'DELAY', { def: 0.3 }),
        k('r.decay', 'DECAY', { def: 0.5 }), k('r.mix', 'REVERB', { def: 0.25 }), k('c.depth', 'MOD', { def: 0.3 }),
        TOG('dtype', 'DELAY', ['tape', 'bbd', 'digi'], { virtual: true }), TOG('rtype', 'REVERB', ['spring', 'hall', 'plate'], { virtual: true }),
      ],
      derive: (p) => ({ 'd.mode': [2, 1, 0][p.dtype ?? 0], 'r.mode': [3, 1, 2][p.rtype ?? 0], 'c.on': (p['c.depth'] ?? 0.3) > 0.02 ? 1 : 0, 'c.rate': 0.25 }),
      desc: 'Time-effects processor: delay (tape / BBD / digital) into a chorus and a spring, hall or plate reverb.',
    }),
    D({
      id: 'drb.disorder', name: 'Chaos Fuzz Filter', ref: 'Dreadbox Disorder', code: 'CHAOS', logo: 'CHAOS', typeName: 'Fuzz · resonant filter', cat: 'Fuzz', art: 'disorder', cost: 1,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'muff', stages: 2, stage2Db: 8, gainMinDb: 10, gainMaxDb: 50, tone: 'none', levelMaxDb: 2, outTrim: 0.18 } },
        { prefix: 'w', algo: 'wah', opts: { fLo: 200, fHi: 5000 }, params: { filter: 0, level: 0.5 } },
      ] },
      controls: [
        k('f.gain', 'FUZZ', { def: 0.6 }), k('f.level', 'VOLUME', { def: 0.5 }), k('f.blend', 'BLEND', { def: 1 }),
        k('w.pos', 'CUTOFF', { def: 0.55 }), k('w.q', 'RESONANCE', { def: 0.45 }), k('w.sens', 'ENV / RATE', { def: 0.5 }),
        TOG('w.filter', 'FILTER', ['lp', 'bp', 'hp'], { def: 0 }), TOG('fmod', 'MOD', ['man', 'env', 'lfo'], { virtual: true }),
      ],
      derive: (p) => ({ 'w.mode': [0, 2, 1][p.fmod ?? 0], 'w.rate': p['w.sens'] ?? 0.5, 'w.range': 0.4 + 0.6 * (p['w.pos'] ?? 0.55) }),
      desc: 'Two-stage fuzz into a resonant multimode filter that can be set by hand, follow your picking (env) or sweep with an LFO.',
    }),
  ]);
}
