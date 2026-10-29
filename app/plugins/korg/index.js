// Built-in Tone Zone plugin: Korg.
// Blocks inspired by Korg stompboxes. Names, logos and artwork are Tone Zone originals; control layouts,
// enclosure shapes and colours follow the real units (see each block's `ref`).
//
// "korg-diva" form: the small die-cast vocal-synth stomp (74 x 120 mm): a glossy teal box with a black lower
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
      desc: 'Play single notes and a synth voice sings them back (E2 to E6). The selector picks what it sings: random syllables, scat, Looh, Lahh, Ahh, Pahh, a cat-like Nyan or three phrases. PEAK lights when your input is too loud. Mute unused strings, it follows one note at a time.',
    }),
  ]);

  // ---------------------------------------------------------------- tuner, vibe, delay and multi-FX
  // "korg-box": plain enclosure with an optional top panel; every control has explicit coordinates.
  const { K: KK, TOG, BTN, SCREEN, TREADLE, db, ms, ten, STEREO } = tz.helpers;
  tz.addForm('korg-box', (ctx, d) => {
    const g = ctx.g, w = d.fw, h = d.fh;
    const txt = d.text || '#e8e8e8';
    formKit.body(g, w, h, d.color, { rx: d.rx ?? 8, brushed: d.brushed });
    const p = d.panel;
    if (p) {
      svg('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.rx ?? 5, fill: p.color }, g);
      if (p.brushed) svg('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.rx ?? 5, fill: 'url(#p-brushed)', opacity: 0.7 }, g);
      svg('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.rx ?? 5, fill: 'none', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.8 }, g);
    }
    for (const ln of d.lines || []) svg('rect', { x: ln[0], y: ln[1], width: ln[2], height: ln[3], fill: ln[4] || d.accent || '#888' }, g);
    const [lx, ly] = d.logoAt;
    label(g, lx, ly, d.logo, { size: d.logoSize || 14, fill: d.logoColor || txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.4, anchor: d.logoAnchor || 'middle' });
    if (d.tagline) label(g, lx, ly + (d.logoSize || 14) * 0.7 + 4, d.tagline, { size: 5, fill: d.accent || txt, weight: 700, ls: 1.4, anchor: d.logoAnchor || 'middle' });
    formKit.tzBadge(g, d.badgeAt ? d.badgeAt[0] : w / 2, d.badgeAt ? d.badgeAt[1] : h - 7, txt, 4);
    const theme = { text: d.panelText || txt, knob: d.knob || 'mxr', labelSize: 5.6, labelFont: "'Barlow Condensed', sans-serif", toggleTitles: true };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme: Object.assign({}, theme, { text: txt, jackText: d.jacksTop && p ? d.panelText : txt }), jacks: d.jacksTop ? formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { flip: ctx.flip, y0: d.jy0 ?? 50, gap: 26 }) };
  });
  const at = (c, x, y, o = {}) => Object.assign(c, { x, y }, o);
  const kk = (p, l, o = {}) => KK(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    def({
      id: 'korg.pitchblack', name: 'Pitch Noir', code: 'PN-1', logo: 'PITCH NOIR', ref: 'Korg Pitchblack', brand: 'Korg', cat: 'Utility', kind: 'Utility',
      typeName: 'Chromatic pedal tuner', form: 'korg-box', jy0: 150, fw: 120, fh: 214, color: '#18181a', text: '#d8d8d8', accent: '#ff3b30', logoAt: [60, 118], logoSize: 13, tagline: 'CHROMATIC TUNER',
      algo: 'tuner', opts: { mute: 1 },
      controls: [
        at(SCREEN('tu3'), 60, 52, { w: 100, h: 50 }),
        at(BTN('DISPLAY', { cycle: 'tunerMode', r: 4, labelPos: 'below' }), 60, 92),
        at(FOOT({ style: 'stomp', r: 13 }), 60, 176),
      ],
      defaultBypass: true, tunerBlock: true,
      desc: 'Press the switch to tune with the output muted. DISPLAY swaps the meter style.',
    }),
    def({
      id: 'korg.nuvibe', name: 'Neo Vibe', code: 'NV-1', logo: 'NEO VIBE', ref: 'Korg Nuvibe', brand: 'Korg', cat: 'Modulation', kind: 'Pedal',
      typeName: 'Vibe with speed treadle', form: 'korg-box', jacksTop: true, fw: 236, fh: 214, color: '#2a2b2e', text: '#e9e3d2', accent: '#d9b25c', knob: 'chrome',
      panel: { x: 8, y: 8, w: 118, h: 198, color: '#3a3b3f', brushed: true }, panelText: '#f1ecdc', logoAt: [67, 120], logoSize: 16, tagline: 'VINTAGE VIBE', badgeAt: [67, 199],
      algo: 'vibe', cost: 0.6,
      controls: [
        at(kk('level', 'VOLUME', { def: 0.5 }), 36, 36, { r: 12 }), at(kk('intensity', 'INTENSITY', { def: 0.7 }), 98, 36, { r: 12 }),
        at(kk('tone', 'TONE', { def: 0.6 }), 36, 84, { r: 10 }), at(TOG('mode', 'MODE', ['CHORUS', 'VIBRATO']), 98, 86),
        at(TREADLE('speed', { def: 0.4 }), 181, 104, { w: 82, h: 180, color: '#1c1c1e', logo: 'SPEED', logoColor: '#d9b25c', logoFont: "'Oswald', sans-serif", logoSize: 12 }),
        at(LED({ color: '#ff2a1a', r: 2.6 }), 67, 150), at(FOOT({ style: 'stomp', r: 12 }), 67, 176),
      ],
      desc: 'Photocell vibe with a built-in treadle for the speed. CHORUS mixes in the dry signal, VIBRATO is pitch wobble only.',
    }),
    def({
      id: 'korg.sdd3000', name: 'Studio Delay 3K', code: 'SD-3K', logo: 'STUDIO DELAY 3K', ref: 'Korg SDD-3000 Pedal', brand: 'Korg', cat: 'Delay', kind: 'Pedal',
      typeName: 'Programmable digital delay', form: 'korg-box', jacksTop: true, fw: 236, fh: 214, color: '#161618', text: '#e6e6e6', accent: '#e8402e', knob: 'strymon',
      panel: { x: 8, y: 8, w: 220, h: 112, color: '#c9ccd1', brushed: true }, panelText: '#141414', logoAt: [118, 136], logoSize: 13, tagline: 'DIGITAL DELAY',
      stereo: 'stereo', ports: STEREO, cost: 1.4,
      algo: 'delay', opts: { maxMs: 3000 },
      controls: [
        at(KK('time', 'DELAY TIME', { min: 10, max: 3000, def: 420, display: ms, curve: 'log' }), 40, 40, { r: 14 }),
        at(kk('feedback', 'FEEDBACK', { def: 0.35, max: 1.05 }), 90, 40, { r: 11 }),
        at(kk('mix', 'DELAY LEVEL', { def: 0.4 }), 140, 40, { r: 11 }),
        at(kk('tone', 'FILTER', { def: 0.65 }), 190, 40, { r: 11 }),
        at(kk('modrate', 'MOD SPEED', { def: 0.25 }), 65, 90, { r: 9 }),
        at(kk('moddepth', 'MOD WIDTH', { def: 0.15 }), 115, 90, { r: 9 }),
        at(TOG('dmode', 'MODE', ['DIGI', 'TAPE', 'PING']), 175, 92),
        at(FOOT({ style: 'stomp', r: 12 }), 66, 180), at(FOOT({ style: 'stomp', r: 12, action: 'tap' }), 170, 180),
        at(LED({ color: '#3ddc84', r: 2.6 }), 66, 156), at(LED({ bind: 'tap:time', color: '#ff3b30', r: 2.6 }), 170, 156),
      ],
      derive: (p) => ({ mode: [0, 2, 7][p.dmode ?? 0], age: 0.2 }),
      desc: 'Studio-style digital delay with modulation, filter, tape and ping-pong modes and tap tempo.',
    }),
    def({
      id: 'korg.pandorastomp', name: 'Pandora Box Stomp', code: 'PX-S', logo: 'BOX OF TONES', ref: 'Korg Pandora Stomp', brand: 'Korg', cat: 'Multi-FX', kind: 'Multi-FX',
      typeName: 'Compact multi-effect', form: 'korg-box', jacksTop: true, fw: 132, fh: 214, color: '#2b2e33', text: '#e6e9ee', accent: '#ff6a1f', knob: 'strymon',
      panel: { x: 8, y: 8, w: 116, h: 118, color: '#9aa1aa', brushed: true }, panelText: '#121417', logoAt: [66, 140], logoSize: 12, tagline: 'MULTI EFFECTS',
      algo: 'chain', cost: 3.4, stereo: 'both',
      opts: { chain: [
        { prefix: 'a', algo: 'amp', opts: { preamp: true, models: ['twin', 'ac30', 'plexi', 'jcm800', 'recto', 'svt'] } },
        { prefix: 'c', algo: 'cab', opts: { models: ['2x12twin', '2x12blue', '4x12gb', '4x12gb', '4x12v30', '8x10svt'] } },
        { prefix: 'm', algo: 'chorus', params: { mix: 0.45 } },
        { prefix: 'd', algo: 'delay', params: { mix: 0.25, time: 380, feedback: 0.3 }, opts: { maxMs: 1500 } },
        { prefix: 'r', algo: 'reverb', params: { mix: 0.2, decay: 0.45, mode: 0 } },
      ] },
      controls: [
        at(SEL('a.channel', 'AMP', ['CLN', 'VOX', 'PLX', 'BRT', 'MTL', 'BASS'], { def: 2, sweep: 220, optSize: 4.2, labelRadius: 6 }), 38, 40, { r: 11 }),
        at(kk('a.gain', 'GAIN', { def: 0.5 }), 94, 40, { r: 11 }),
        at(kk('m.mix', 'MOD', { def: 0 }), 30, 92, { r: 9 }),
        at(kk('d.mix', 'DELAY', { def: 0.2 }), 66, 92, { r: 9 }),
        at(kk('r.mix', 'REVERB', { def: 0.2 }), 102, 92, { r: 9 }),
        at(LED({ color: '#ff6a1f', r: 2.6 }), 66, 164), at(FOOT({ style: 'stomp', r: 12 }), 66, 188),
      ],
      derive: (p) => ({ 'c.model': p['a.channel'] ?? 2, 'm.on': (p['m.mix'] ?? 0) > 0.01 ? 1 : 0, 'd.on': (p['d.mix'] ?? 0.2) > 0.01 ? 1 : 0, 'r.on': (p['r.mix'] ?? 0.2) > 0.01 ? 1 : 0, 'a.level': -4 }),
      initParams: { 'a.bass': 0.5, 'a.mid': 0.5, 'a.treble': 0.55 },
      desc: 'Pocket multi-effect: amp and cab models with chorus, delay and reverb. Turn an effect knob to zero to switch it off.',
    }),
  ]);
}
