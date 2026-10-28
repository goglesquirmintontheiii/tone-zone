// Built-in Tone Zone plugin: Korg.
// Blocks inspired by Korg stompboxes. Names, logos and artwork are Tone Zone originals; control layouts,
// enclosure shapes and colours follow the real units (see each block's `ref`).
//
// "korg-diva" form: the small die-cast vocal-synth stomp (74 x 120 mm) – a glossy teal box with a black lower
// deck, one big pattern selector, effect + peak LEDs and the footswitch. The artwork is original: twin ribbon
// "pigtails" sweeping down the sides, a staff of notes and a singing waveform.
export default function register(tz) {
  const { SEL, FOOT, LED, K, def, MONO } = tz.helpers;
  const { svg, label, formKit, softShadow, noisePattern } = tz.gfx;

  function ensureDefs() {
    if (document.getElementById('korg-gloss')) return;
    const d = document.getElementById('globalDefs');
    if (!d) return;
    const lg = (id, stops, o = {}) => {
      const gr = svg('linearGradient', { id, x1: o.x1 ?? 0, y1: o.y1 ?? 0, x2: o.x2 ?? 0, y2: o.y2 ?? 1 }, d);
      for (const [off, col, op] of stops) svg('stop', { offset: off, 'stop-color': col, 'stop-opacity': op ?? 1 }, gr);
    };
    lg('korg-gloss', [[0, '#fff', 0.34], [0.12, '#fff', 0.06], [0.5, '#fff', 0], [1, '#000', 0.22]]);
    lg('korg-ribbon', [[0, '#0f7f86'], [1, '#08454c']], { x2: 1, y2: 1 });
    lg('korg-deck', [[0, '#26292d'], [1, '#0d0e10']]);
    lg('korg-wave', [[0, '#ff4fa3'], [0.5, '#ffffff'], [1, '#55e6dc']], { x2: 1, y2: 0 });
    noisePattern(d, 'korg-metal', 30, 60, [255, 255, 255], 0, 0.07, 1);
  }

  tz.addForm('korg-diva', (ctx, d) => {
    ensureDefs();
    const g = ctx.g, w = 128, h = 210, rx = 9;
    const teal = d.color || '#33c3bd', pink = d.accent || '#ff3f9a';
    softShadow(g, { w, h, rx, dy: 14, blur: 9, opacity: 0.6 });
    svg('rect', { width: w, height: h, rx, fill: teal }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#korg-metal)' }, g);
    // black lower deck (footswitch area)
    svg('path', { d: `M0 140 Q${w / 2} 128 ${w} 140 V${h - rx} Q${w} ${h} ${w - rx} ${h} H${rx} Q0 ${h} 0 ${h - rx} Z`, fill: 'url(#korg-deck)' }, g);
    svg('path', { d: `M0 140 Q${w / 2} 128 ${w} 140`, fill: 'none', stroke: pink, 'stroke-width': 1.6 }, g);
    // twin ribbon pigtails sweeping down both sides
    for (const s of [-1, 1]) {
      const x0 = w / 2 + s * 30, xe = w / 2 + s * 60;
      svg('path', { d: `M${x0} 10 C${x0 + s * 26} 18 ${xe + s * 2} 50 ${xe - s * 4} 92 C${xe - s * 8} 112 ${xe + s * 2} 126 ${xe - s * 2} 136 L${xe - s * 12} 132 C${xe - s * 14} 112 ${xe - s * 20} 90 ${xe - s * 18} 62 C${xe - s * 16} 40 ${x0 + s * 6} 22 ${x0} 10 Z`, fill: 'url(#korg-ribbon)', 'fill-opacity': 0.85 }, g);
      svg('path', { d: `M${x0 + s * 4} 14 C${x0 + s * 22} 26 ${xe - s * 6} 54 ${xe - s * 9} 92`, fill: 'none', stroke: '#9ff5ee', 'stroke-width': 0.8, 'stroke-opacity': 0.6 }, g);
      // hair ties
      svg('rect', { x: x0 - 4, y: 6, width: 8, height: 6, rx: 1.6, fill: pink, transform: `rotate(${s * 24} ${x0} 9)` }, g);
    }
    // music staff + notes across the top
    for (let i = 0; i < 5; i++) svg('line', { x1: 20, x2: w - 20, y1: 22 + i * 2.6, y2: 22 + i * 2.6, stroke: '#063b40', 'stroke-width': 0.45, 'stroke-opacity': 0.55 }, g);
    const note = (x, y, rot = -18) => {
      svg('ellipse', { cx: x, cy: y, rx: 2.6, ry: 1.8, transform: `rotate(${rot} ${x} ${y})`, fill: '#063b40' }, g);
      svg('path', { d: `M${x + 2.3} ${y - 0.6} V${y - 10} q3 2 4 5`, fill: 'none', stroke: '#063b40', 'stroke-width': 0.9 }, g);
    };
    note(30, 29); note(44, 24.5); note(84, 27); note(98, 22);
    // singing waveform above the deck
    let wp = 'M14 118';
    for (let x = 14; x <= w - 14; x += 2) {
      const t = (x - 14) / (w - 28);
      wp += ` L${x} ${(118 + Math.sin(t * Math.PI * 9) * 7 * Math.sin(t * Math.PI)).toFixed(1)}`;
    }
    svg('path', { d: wp, fill: 'none', stroke: 'url(#korg-wave)', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
    // logo
    const t1 = label(g, w / 2, 102, d.logo || 'DIVA', { size: 21, fill: '#ffffff', font: "'Oswald', sans-serif", weight: 700, ls: 3 });
    t1.setAttribute('stroke', '#08454c'); t1.setAttribute('stroke-width', 2.4); t1.setAttribute('paint-order', 'stroke');
    label(g, w / 2, 132, d.tagline || 'VOCAL SYNTH STOMP', { size: 5.2, fill: '#08454c', weight: 800, ls: 1.6 });
    svg('rect', { width: w, height: h, rx, fill: 'url(#korg-gloss)', 'pointer-events': 'none' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, g);
    label(g, w / 2, h - 8, 'TONE ZONE', { size: 4.4, fill: '#9aa1a8', weight: 800, ls: 1.4 });

    for (const c of d.controls) {
      if (c.x !== undefined && !c._auto) continue;
      c._auto = true;
      if (c.t === 'sel') Object.assign(c, { x: w / 2, y: 60, r: 17, labelPos: 'none', labelRadius: 10, optSize: 4.6 });
      else if (c.t === 'foot') Object.assign(c, { x: w / 2, y: 172, r: 13 });
      else if (c.t === 'led' && c.bind === 'on') Object.assign(c, { x: 22, y: 152, r: 2.6 });
      else if (c.t === 'led') Object.assign(c, { x: w - 22, y: 152, r: 2.6 });
    }
    // LED captions on the deck
    label(g, 22, 160, 'EFFECT', { size: 4.4, fill: '#d6dadf', weight: 700, ls: 0.6 });
    label(g, w - 22, 160, 'PEAK', { size: 4.4, fill: '#d6dadf', weight: 700, ls: 0.6 });
    const theme = { text: '#063b40', knob: 'white', labelSize: 6, labelFont: "'Barlow Condensed', sans-serif" };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: 66, gap: 26 }) };
  });

  // pattern selector: Random 1, Random 2, Scat, Looh, Lahh, Ahh, Pahh, Nyan, Phrase 1-3
  // vocal engine: lyric 0 = the vowel param, 1 "mi-ku", 2 a-e-i-o-u, 3 meow, 4 la-la gibberish
  const PAT = [
    { lyric: 1, attack: 0.12, release: 0.35, vibrato: 0.3, glide: 0.2 },            // RANDOM 1: "mi-ku" syllables
    { lyric: 4, attack: 0.12, release: 0.35, vibrato: 0.3, glide: 0.25 },           // RANDOM 2: la-la gibberish
    { lyric: 2, attack: 0.04, release: 0.18, vibrato: 0.1, glide: 0.08 },           // SCAT: quick vowels
    { lyric: 0, vowel: 4, attack: 0.2, release: 0.45, vibrato: 0.35, glide: 0.25 }, // LOOH
    { lyric: 0, vowel: 0, attack: 0.1, release: 0.4, vibrato: 0.3, glide: 0.2 },    // LAHH
    { lyric: 0, vowel: 0, attack: 0.32, release: 0.55, vibrato: 0.45, glide: 0.3, breath: 0.25 }, // AHH (soft onset)
    { lyric: 0, vowel: 0, attack: 0.02, release: 0.2, vibrato: 0.15, glide: 0.1 },  // PAHH (plosive)
    { lyric: 3, attack: 0.06, release: 0.3, vibrato: 0.25, glide: 0.2, shift: 0.62 }, // NYAN
    { lyric: 1, attack: 0.1, release: 0.4, vibrato: 0.5, glide: 0.35 },             // PHRASE 1
    { lyric: 2, attack: 0.15, release: 0.5, vibrato: 0.4, glide: 0.4 },             // PHRASE 2
    { lyric: 4, attack: 0.08, release: 0.3, vibrato: 0.55, glide: 0.3, shift: 0.58 }, // PHRASE 3
  ];

  tz.addDefs([
    def({
      id: 'korg.mikustomp', name: 'Diva Stomp', code: 'DIVA', logo: 'DIVA', ref: 'Korg Miku Stomp', brand: 'Korg', cat: 'Synth', kind: 'Pedal',
      typeName: 'Vocal synth stomp', form: 'korg-diva', color: '#33c3bd', accent: '#ff3f9a', cost: 1.2,
      tags: ['vocaloid', 'singing', 'voice', 'vocal synth', 'mi-ku', 'novelty'],
      algo: 'chain',
      opts: { chain: [{ prefix: 'm', algo: 'meter' }, { prefix: 'v', algo: 'vocal', params: { mode: 1, lyric: 1, shift: 0.55, octave: 0, tone: 0.62, drive: 0.15, breath: 0.12, sens: 0.55, mix: 0.6, dry: 0, level: -24 } }] },
      controls: [
        SEL('pattern', 'PATTERN', ['RND1', 'RND2', 'SCAT', 'LOOH', 'LAHH', 'AHH', 'PAHH', 'NYAN', 'PH1', 'PH2', 'PH3'], { sweep: 300, virtual: true }),
        FOOT(),
        LED({ color: '#ff3f9a' }),
        LED({ bind: 'fn', sub: 'm', color: '#ff2a1a', ledFn: (ui, b, st) => (st && st.meter && st.meter[0] && st.meter[0][0] > 0.89 ? '#ff2a1a' : null) }),
      ],
      derive: (u) => {
        const p = PAT[u.pattern | 0] || PAT[0];
        const o = { 'v.mode': 1, 'v.vowel': 0, 'v.shift': 0.55, 'v.breath': 0.12 };
        for (const k in p) o['v.' + k] = p[k];
        return o;
      },
      desc: 'Play single notes and a synthetic diva sings them back (monophonic, tracks E2–E6). The selector picks the syllable pattern: two random "mi-ku" / gibberish lyrics, scat, Looh, Lahh, Ahh, Pahh, a cat-like Nyan and three phrases. PEAK lights when your input is too hot. Mute unused strings – it tracks one note at a time.',
    }),
  ]);
}
