// Built-in Tone Zone plugin: The Fart Pedal.
// Inspired by The Fart Pedal (Steve Gadlin's Kickstarter novelty stomp). Name, logo and artwork are Tone Zone
// originals; the control set (one OUTPUT knob, a WET / DRY toggle, footswitch) follows the real unit.
//
// "toot" form: a cream box with a cartoon whoopee cushion and a little puff cloud. Funny, not gross.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def } = tz.helpers;
  const { svg, label, formKit, softShadow, noisePattern } = tz.gfx;

  function ensureDefs() {
    if (document.getElementById('toot-cushion')) return;
    const d = document.getElementById('globalDefs');
    if (!d) return;
    const rg = (id, stops, o = {}) => {
      const gr = svg('radialGradient', { id, cx: o.cx ?? 0.38, cy: o.cy ?? 0.32, r: o.r ?? 0.75 }, d);
      for (const [off, col, op] of stops) svg('stop', { offset: off, 'stop-color': col, 'stop-opacity': op ?? 1 }, gr);
    };
    rg('toot-cushion', [[0, '#ff9ab8'], [0.55, '#ef4f7f'], [1, '#b0224f']]);
    rg('toot-cloud', [[0, '#ffffff'], [0.7, '#e9f3dc'], [1, '#c6dcae']]);
    const lg = svg('linearGradient', { id: 'toot-gloss', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    for (const [o, c, a] of [[0, '#fff', 0.3], [0.12, '#fff', 0.05], [0.6, '#fff', 0], [1, '#000', 0.22]]) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, lg);
    noisePattern(d, 'toot-speck', 34, 68, [90, 60, 30], 0, 0.1, 1);
  }

  tz.addForm('toot', (ctx, d) => {
    ensureDefs();
    const g = ctx.g, w = 122, h = 220, rx = 8, ink = '#3b2414';
    softShadow(g, { w, h, rx, dy: 14, blur: 9, opacity: 0.6 });
    svg('rect', { width: w, height: h, rx, fill: d.color || '#f3e6c8' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#toot-speck)' }, g);
    // whoopee cushion (squashed bladder + neck) mid-toot
    const cx = 56, cy = 112;
    svg('ellipse', { cx: cx + 2, cy: cy + 15, rx: 32, ry: 4, fill: '#000', 'fill-opacity': 0.15 }, g);
    svg('path', { d: `M${cx - 30} ${cy + 4} C${cx - 34} ${cy - 14} ${cx - 10} ${cy - 22} ${cx + 6} ${cy - 18} C${cx + 24} ${cy - 14} ${cx + 30} ${cy - 2} ${cx + 26} ${cy + 8} C${cx + 20} ${cy + 18} ${cx - 24} ${cy + 18} ${cx - 30} ${cy + 4} Z`, fill: 'url(#toot-cushion)', stroke: ink, 'stroke-width': 1.4 }, g);
    svg('path', { d: `M${cx - 20} ${cy - 8} q10 -8 22 -6`, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-opacity': 0.6, 'stroke-linecap': 'round' }, g);
    svg('path', { d: `M${cx + 24} ${cy - 2} l10 -3 q3 0 3 3 l-0 4 q0 3 -3 3 l-10 -2 Z`, fill: '#ef4f7f', stroke: ink, 'stroke-width': 1.2 }, g);
    svg('ellipse', { cx: cx + 37.5, cy: cy + 1.5, rx: 1.4, ry: 3.6, fill: '#7a1430' }, g);
    // sound lines + puff cloud
    for (let i = 0; i < 3; i++) svg('path', { d: `M${cx + 43 + i * 4} ${cy - 6 - i * 2} q4 ${7 + i * 2} 0 ${14 + i * 4}`, fill: 'none', stroke: ink, 'stroke-width': 1.1, 'stroke-linecap': 'round', 'stroke-opacity': 1 - i * 0.25 }, g);
    const pc = [[cx + 36, cy - 32, 7], [cx + 45, cy - 36, 8], [cx + 42, cy - 26, 6.5], [cx + 52, cy - 29, 6]];
    for (const [x, y, r] of pc) svg('circle', { cx: x, cy: y, r, fill: 'url(#toot-cloud)', stroke: '#6f8a52', 'stroke-width': 0.8 }, g);
    for (const [x, y, r] of pc) svg('circle', { cx: x, cy: y, r: r - 0.9, fill: 'url(#toot-cloud)' }, g);
    label(g, cx + 44, cy - 31, '*toot*', { size: 6, fill: '#4c6b33', weight: 800, font: "'Barlow Condensed', sans-serif" });
    // logo
    label(g, w / 2, 144, 'THE', { size: 6.5, fill: ink, weight: 800, ls: 3 });
    const t = label(g, w / 2, 160, d.logo || 'TOOT PEDAL', { size: 17, fill: '#ef4f7f', font: "'Oswald', sans-serif", weight: 700, ls: 1.4 });
    t.setAttribute('stroke', ink); t.setAttribute('stroke-width', 2.4); t.setAttribute('paint-order', 'stroke');
    label(g, w / 2, 172, 'BESPOKE AIR-BISCUIT GENERATOR', { size: 4.4, fill: ink, weight: 700, ls: 0.8 });
    svg('rect', { width: w, height: h, rx, fill: 'url(#toot-gloss)', 'pointer-events': 'none' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, g);
    label(g, w / 2, h - 7, 'TONE ZONE', { size: 4.2, fill: ink, weight: 800, ls: 1.2, opacity: 0.6 });
    for (const c of d.controls) {
      if (c.x !== undefined && !c._auto) continue;
      c._auto = true;
      if (c.t === 'knob') Object.assign(c, { x: 40, y: 46, r: 14, labelPos: 'above' });
      else if (c.t === 'toggle') Object.assign(c, { x: 84, y: 46, orient: 'v' });
      else if (c.t === 'foot') Object.assign(c, { x: w / 2, y: 194, r: 11 });
      else if (c.t === 'led') Object.assign(c, { x: w / 2, y: 76, r: 2.6 });
    }
    const theme = { text: ink, knob: 'chicken', labelSize: 6.6, labelFont: "'Barlow Condensed', sans-serif" };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: 134, gap: 26 }) };
  });

  tz.addDefs([
    def({
      id: 'fartpedal.fart', name: 'The Toot Pedal', code: 'TOOT', logo: 'TOOT PEDAL', ref: 'The Fart Pedal', brand: 'The Fart Pedal', cat: 'Synth', kind: 'Pedal',
      typeName: 'Whoopee-cushion synth', form: 'toot', color: '#f3e6c8', cost: 1,
      tags: ['fart', 'novelty', 'funny', 'whoopee', 'joke'],
      algo: 'vocal', opts: { mode: 3 }, fixed: { mode: 3, lyric: 0, vowel: 7, level: -24, dry: 0, octave: 0 },
      controls: [
        K('mix', 'OUTPUT', { def: 0.55 }),
        TOG('wet', 'STYLE', ['WET', 'DRY'], { def: 0, virtual: true }),
        FOOT(), LED({ color: '#7fd34a' }),
      ],
      derive: (u) => (u.wet
        ? { shift: 0.62, breath: 0.08, drive: 0.15, tone: 0.55, glide: 0.1, vibrato: 0.15, attack: 0.05, release: 0.2, sens: 0.5 }   // DRY: short, crisp, squeaky
        : { shift: 0.38, breath: 0.45, drive: 0.55, tone: 0.42, glide: 0.35, vibrato: 0.5, attack: 0.12, release: 0.55, sens: 0.55 }), // WET: low, flappy, long
      desc: 'Turns your guitar into a whoopee cushion that follows your pitch. WET is low, long and flappy, DRY is short and squeaky. OUTPUT sets the volume. Single notes work best.',
    }),
  ]);
}
