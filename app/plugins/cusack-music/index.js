// Built-in Tone Zone plugin: Cusack Music.
// Inspired by the Meowdulator (Cusack Music x B's Music Shop), the guitar "cat synthesizer". Name, logo and
// artwork are Tone Zone originals; the control set follows the real unit: three knobs all labelled MEOW
// (meow-volume, the 8-voicing selector, whisker intensity) and a bypass footswitch that purrs while held.
//
// "cusack-cat" form: a cat-head shaped top (ears!) on an orange box with a printed cat face and whiskers.
export default function register(tz) {
  const { K, SEL, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, softShadow, noisePattern } = tz.gfx;

  function ensureDefs() {
    if (document.getElementById('cus-fur')) return;
    const d = document.getElementById('globalDefs');
    if (!d) return;
    const lg = svg('linearGradient', { id: 'cus-gloss', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    for (const [o, c, a] of [[0, '#fff', 0.3], [0.15, '#fff', 0.05], [1, '#000', 0.25]]) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, lg);
    noisePattern(d, 'cus-fur', 30, 60, [120, 50, 0], 0, 0.14, 2);
    const gr = svg('radialGradient', { id: 'cus-eye', cx: 0.4, cy: 0.35, r: 0.7 }, d);
    for (const [o, c] of [[0, '#d8ff8a'], [0.7, '#7fd34a'], [1, '#3f7a1c']]) svg('stop', { offset: o, 'stop-color': c }, gr);
  }

  tz.addForm('cusack-cat', (ctx, d) => {
    ensureDefs();
    const g = ctx.g, w = 130, h = 232, ink = '#2a1606';
    const col = d.color || '#f2a33a';
    // silhouette: box with two ears on top
    const shape = `M0 30 L8 2 L36 22 H94 L122 2 L130 30 V${h - 9} Q130 ${h} 121 ${h} H9 Q0 ${h} 0 ${h - 9} Z`;
    softShadow(g, { w, h, rx: 9, dy: 14, blur: 9, opacity: 0.6 });
    svg('path', { d: shape, fill: col }, g);
    svg('path', { d: shape, fill: 'url(#cus-fur)' }, g);
    for (const s of [-1, 1]) {
      const x = s < 0 ? 0 : w;
      svg('path', { d: `M${x + s * -10} 26 L${x + s * -12} 10 L${x + s * -28} 22 Z`, fill: '#ff9db8', 'fill-opacity': 0.85 }, g);
    }
    // tabby stripes
    for (const x of [52, 65, 78]) svg('path', { d: `M${x - 3} 23 q3 9 0 16`, fill: 'none', stroke: '#b5651d', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-opacity': 0.7 }, g);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) svg('path', { d: `M${s < 0 ? 0 : w} ${110 + i * 14} q${s * -12} 3 ${s * -18} -2`, fill: 'none', stroke: '#b5651d', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-opacity': 0.6 }, g);
    // face: eyes, nose, mouth, whiskers
    const cy = 116;
    for (const s of [-1, 1]) {
      svg('ellipse', { cx: w / 2 + s * 22, cy, rx: 10, ry: 8, fill: 'url(#cus-eye)', stroke: ink, 'stroke-width': 1.2 }, g);
      svg('ellipse', { cx: w / 2 + s * 22, cy, rx: 2.2, ry: 7, fill: ink }, g);
      svg('circle', { cx: w / 2 + s * 22 - 3, cy: cy - 3, r: 1.6, fill: '#fff' }, g);
      for (let i = -1; i <= 1; i++) svg('path', { d: `M${w / 2 + s * 14} ${cy + 20 + i * 3} q${s * 20} ${i * 3 - 2} ${s * 42} ${i * 7 - 1}`, fill: 'none', stroke: ink, 'stroke-width': 0.9, 'stroke-linecap': 'round' }, g);
    }
    svg('path', { d: `M${w / 2 - 5} ${cy + 12} h10 l-5 5 Z`, fill: '#ff6f91', stroke: ink, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }, g);
    svg('path', { d: `M${w / 2} ${cy + 17} v3 q-4 5 -9 1 M${w / 2} ${cy + 20} q4 5 9 1`, fill: 'none', stroke: ink, 'stroke-width': 1.1, 'stroke-linecap': 'round' }, g);
    // logo
    const t = label(g, w / 2, 160, d.logo || 'Catterwaul', { size: 21, fill: '#fff8ec', font: "'Dancing Script', cursive", weight: 700 });
    t.setAttribute('stroke', ink); t.setAttribute('stroke-width', 2.6); t.setAttribute('paint-order', 'stroke');
    label(g, w / 2, 174, 'GUITAR CAT SYNTHESIZER', { size: 5, fill: ink, weight: 800, ls: 1.2 });
    svg('path', { d: shape, fill: 'url(#cus-gloss)', 'pointer-events': 'none' }, g);
    svg('path', { d: shape, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, g);
    label(g, w / 2, h - 7, 'TONE ZONE', { size: 4.2, fill: ink, weight: 800, ls: 1.2, opacity: 0.6 });
    for (const c of d.controls) {
      if (c.x !== undefined && !c._auto) continue;
      c._auto = true;
      if (c.t === 'knob' || c.t === 'sel') {
        const i = d.controls.filter((k) => k.t === 'knob' || k.t === 'sel').indexOf(c);
        Object.assign(c, { x: [28, 65, 102][i], y: i === 1 ? 70 : 54, r: i === 1 ? 13 : 12, labelPos: i === 1 ? 'none' : 'above' });
      } else if (c.t === 'foot') Object.assign(c, { x: w / 2, y: 204, r: 12 });
      else if (c.t === 'led') Object.assign(c, { x: w / 2 + 30, y: 204, r: 2.6 });
    }
    const theme = { text: ink, knob: 'cream', labelSize: 7, labelFont: "'Barlow Condensed', sans-serif" };
    formKit.placeControls(ctx, d.controls, theme);
    label(g, 65, 37, 'MEOW', { size: 7, fill: ink, weight: 700, font: "'Barlow Condensed', sans-serif", ls: 0.4 });
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: 70, gap: 28 }) };
  });

  // eight voicings for the vocal engine's meow mode (lyric 3 = m-i-a-u, 4 = random syllables)
  const VOICES = [
    { name: 'Staccato Kitten', o: { mode: 2, octave: 1, shift: 0.72, attack: 0.03, release: 0.12, glide: 0.15, vibrato: 0.2, drive: 0.2, tone: 0.7, lyric: 3 } },
    { name: 'Staccato Cat', o: { mode: 2, octave: 0, shift: 0.55, attack: 0.03, release: 0.14, glide: 0.2, vibrato: 0.2, drive: 0.25, tone: 0.6, lyric: 3 } },
    { name: 'Staccato Sad Cat', o: { mode: 2, octave: 0, shift: 0.45, attack: 0.08, release: 0.35, glide: 0.6, vibrato: 0.65, drive: 0.15, tone: 0.5, lyric: 3 } },
    { name: 'Mad Cat Synth', o: { mode: 2, octave: 0, shift: 0.5, attack: 0.05, release: 0.5, glide: 0.3, vibrato: 0.4, drive: 0.85, tone: 0.7, lyric: 3 } },
    { name: 'Acid Kitty Synth', o: { mode: 2, octave: -1, shift: 0.62, attack: 0.04, release: 0.4, glide: 0.55, vibrato: 0.15, drive: 0.6, tone: 0.95, lyric: 3 } },
    { name: 'Kitty Scream Synth', o: { mode: 2, octave: 1, shift: 0.82, attack: 0.06, release: 0.6, glide: 0.25, vibrato: 0.55, drive: 0.9, tone: 1, lyric: 3 } },
    { name: 'Little Mew', o: { mode: 2, octave: 1, shift: 0.92, attack: 0.02, release: 0.1, glide: 0.1, vibrato: 0.1, drive: 0.1, tone: 0.75, breath: 0.3, lyric: 3 } },
    { name: 'Randomized', o: { mode: 2, octave: 0, shift: 0.6, attack: 0.05, release: 0.3, glide: 0.3, vibrato: 0.35, drive: 0.35, tone: 0.65, lyric: 4 } },
  ];
  const PURR = { 'v.mode': 1, 'v.lyric': 0, 'v.vowel': 7, 'v.octave': -2, 'v.shift': 0.35, 'v.glide': 0.9, 'v.vibrato': 0, 'v.breath': 0.5, 'v.drive': 0.3, 'v.tone': 0.35, 't.on': 1 };

  tz.addDefs([
    def({
      id: 'cusack.meowdulator', name: 'Catterwaul', code: 'CATTERWAUL', logo: 'Catterwaul', ref: 'Cusack Music / B’s Music Shop Meowdulator', brand: 'Cusack Music',
      cat: 'Synth', kind: 'Pedal', typeName: 'Guitar cat synth', form: 'cusack-cat', color: '#f2a33a', cost: 1.1,
      tags: ['cat', 'meow', 'purr', 'novelty', 'synth'],
      algo: 'chain',
      opts: { chain: [
        { prefix: 'v', algo: 'vocal', params: { mode: 2, lyric: 3, dry: 0, level: -24, breath: 0.15 } },
        { prefix: 't', algo: 'tremolo', on: false, params: { rate: 0.85, depth: 0.85, wave: 0.2, level: 0.5 } },
      ] },
      controls: [
        K('vol', 'MEOW', { def: 0.6, virtual: true, display: ten }),
        SEL('voice', 'MEOW', VOICES.map((v, i) => String(i + 1)), { def: 1, sweep: 240, optSize: 5, labelRadius: 8, virtual: true }),
        K('whisker', 'MEOW', { def: 0.8, virtual: true, display: ten }),
        FOOT({ hold: { ms: 450 } }),
        LED({ color: '#7fd34a' }),
      ],
      initParams: { _purr: 0 },
      derive: (u) => {
        const v = VOICES[u.voice | 0] || VOICES[1];
        const o = {};
        for (const k in v.o) o['v.' + k] = v.o[k];
        const wk = u.whisker ?? 0.8;
        o['v.mix'] = (u.vol ?? 0.6) * (0.35 + 0.65 * wk) * 1.6;
        o['v.dry'] = (1 - wk) * 0.5;
        o['t.on'] = 0;
        if (u._purr) Object.assign(o, PURR, { 'v.mix': Math.min(1, (u.vol ?? 0.6) * 1.6), 'v.dry': 0 });
        return o;
      },
      desc: 'Every note you play comes back as a cat. Three knobs, all labelled MEOW: the left one is meow-volume, the middle one picks the voicing (1 Staccato Kitten, 2 Staccato Cat, 3 Staccato Sad Cat, 4 Mad Cat Synth, 5 Acid Kitty Synth, 6 Kitty Scream Synth, 7 Little Mew, 8 Randomized) and the right one is the whisker intensity (dry guitar → full cat). Hold the footswitch for a purr.',
    }),
  ]);

  // hold the footswitch → purr (the hold itself is swallowed by the editor, so bypass doesn't toggle)
  const timers = new Map();
  tz.blockHooks('cusack.meowdulator', {
    foot(view, ctl, down) {
      const id = view.block.id;
      clearTimeout(timers.get(id));
      if (down) {
        timers.set(id, setTimeout(() => { if (!view.block.bypass) tz.app.setParam(id, '_purr', 1); }, 450));
      } else if ((view.block.params || {})._purr) tz.app.setParam(id, '_purr', 0);
      return false;
    },
  });
}
