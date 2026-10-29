// Built-in Tone Zone plugin: noiseKICK FX.
// Inspired by noiseKICK FX's Meme Driver (overdrive + fuzz in one box with an order switch). Name, logo and
// artwork are Tone Zone originals; the control set follows the real unit.
//
// "nk-meme" form: a wide black box with halftone dots, neon lettering and an original meme-style mascot
// (a grinning face in pixel shades) between the two channels.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, softShadow, noisePattern } = tz.gfx;

  function ensureDefs() {
    if (document.getElementById('nk-face')) return;
    const d = document.getElementById('globalDefs');
    if (!d) return;
    const gr = svg('radialGradient', { id: 'nk-face', cx: 0.4, cy: 0.35, r: 0.7 }, d);
    for (const [o, c] of [[0, '#fff27a'], [0.7, '#ffd21f'], [1, '#e0a800']]) svg('stop', { offset: o, 'stop-color': c }, gr);
    const lg = svg('linearGradient', { id: 'nk-gloss', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    for (const [o, c, a] of [[0, '#fff', 0.18], [0.15, '#fff', 0.03], [1, '#000', 0.3]]) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, lg);
    const pat = svg('pattern', { id: 'nk-dots', width: 7, height: 7, patternUnits: 'userSpaceOnUse' }, d);
    svg('circle', { cx: 3.5, cy: 3.5, r: 1.1, fill: '#ff3fa4', 'fill-opacity': 0.22 }, pat);
    noisePattern(d, 'nk-grain', 30, 60, [255, 255, 255], 0, 0.06, 1);
  }

  tz.addForm('nk-meme', (ctx, d) => {
    ensureDefs();
    const g = ctx.g, w = 200, h = 204, rx = 8;
    const pink = '#ff3fa4', cyan = '#3ff0ff', txt = '#f6f6f6';
    softShadow(g, { w, h, rx, dy: 14, blur: 9, opacity: 0.6 });
    svg('rect', { width: w, height: h, rx, fill: d.color || '#121214' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#nk-dots)' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#nk-grain)' }, g);
    // channel panels
    svg('rect', { x: 6, y: 6, width: 104, height: 98, rx: 5, fill: 'none', stroke: pink, 'stroke-width': 1.2 }, g);
    svg('rect', { x: 120, y: 6, width: 74, height: 98, rx: 5, fill: 'none', stroke: cyan, 'stroke-width': 1.2 }, g);
    label(g, 58, 98, 'OVERDRIVE', { size: 5.6, fill: pink, weight: 800, ls: 2 });
    label(g, 157, 98, 'FUZZ', { size: 5.6, fill: cyan, weight: 800, ls: 2 });
    // mascot: grinning face with pixel shades + "stonks" arrow
    const cx = w / 2, cy = 134;
    svg('path', { d: `M${cx + 56} ${cy + 12} l6 -6 l4 4 l8 -12`, fill: 'none', stroke: '#3ddc84', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
    svg('path', { d: `M${cx + 76} ${cy - 4} l3 -6 l1.5 6.5 Z`, fill: '#3ddc84' }, g);
    svg('circle', { cx: cx + 30, cy, r: 18, fill: 'url(#nk-face)', stroke: '#1a1408', 'stroke-width': 1.2 }, g);
    // pixel shades
    const px = 2.4, sx = cx + 30 - 14, sy = cy - 6;
    const rows = ['111111111111', '011110011110', '001100001100'];
    rows.forEach((r, j) => [...r].forEach((b, i) => b === '1' && svg('rect', { x: sx + i * px, y: sy + j * px, width: px, height: px, fill: '#0a0a0a' }, g)));
    svg('rect', { x: sx + 1 * px, y: sy + px, width: px, height: px, fill: '#fff' }, g);
    svg('rect', { x: sx + 7 * px, y: sy + px, width: px, height: px, fill: '#fff' }, g);
    svg('path', { d: `M${cx + 19} ${cy + 6} Q${cx + 30} ${cy + 16} ${cx + 41} ${cy + 6} Q${cx + 30} ${cy + 11} ${cx + 19} ${cy + 6} Z`, fill: '#5a1a10', stroke: '#1a1408', 'stroke-width': 0.8 }, g);
    // logo
    const t = label(g, cx - 32, cy + 2, d.logo || 'DANK', { size: 22, fill: '#fff', font: "'Oswald', sans-serif", weight: 700, ls: 2 });
    t.setAttribute('stroke', pink); t.setAttribute('stroke-width', 3); t.setAttribute('paint-order', 'stroke');
    label(g, cx - 32, cy + 17, 'DRIVER · OD / FUZZ', { size: 5, fill: cyan, weight: 800, ls: 1.4 });
    svg('rect', { width: w, height: h, rx, fill: 'url(#nk-gloss)', 'pointer-events': 'none' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'none', stroke: '#000', 'stroke-opacity': 0.7, 'stroke-width': 0.8 }, g);
    label(g, cx, h - 6, 'TONE ZONE', { size: 4.2, fill: '#9a9aa2', weight: 800, ls: 1.2 });
    const theme = { text: txt, knob: 'mxr', labelSize: 6.2, labelFont: "'Barlow Condensed', sans-serif" };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  const odV = { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 0, gainMaxDb: 42, tone: 'ts', toneLo: 700, postLp: 5200, levelMinDb: -30, levelMaxDb: 12 };
  const fuzzV = { clip: 'si', stages: 2, stage2Db: 18, bias: 0.12, preHp: 70, gainMinDb: 18, gainMaxDb: 50, tone: 'blend', blendLp: 480, blendHp: 1200, postLp: 8000, levelMinDb: -34, levelMaxDb: -2 };
  tz.addDefs([
    def({
      id: 'noisekick.memedriver', name: 'Dank Driver', code: 'DANK', logo: 'DANK', ref: 'noiseKICK FX Meme Driver', brand: 'noiseKICK FX', cat: 'Overdrive', typeName: 'Dual overdrive / fuzz',
      form: 'nk-meme', color: '#121214', cost: 1.1,
      tags: ['meme', 'dual', 'fuzz', 'overdrive', 'u no u'],
      algo: 'chain',
      opts: { chain: [
        { prefix: 'o', algo: 'drive', opts: odV },
        { prefix: 'f', algo: 'drive', opts: fuzzV, on: false },
        { prefix: 'p', algo: 'drive', opts: odV, on: false },
      ] },
      controls: [
        K('o.level', 'SCREAM', { x: 24, y: 36, r: 11, def: 0.5, display: ten }), K('o.tone', 'TONE', { x: 58, y: 36, r: 11, def: 0.5, display: ten }), K('o.gain', 'GAIN', { x: 92, y: 36, r: 11, def: 0.5, display: ten }),
        K('f.level', 'SHOUT', { x: 138, y: 36, r: 11, def: 0.5, display: ten }), K('f.gain', 'ATTACK', { x: 176, y: 36, r: 11, def: 0.6, display: ten }),
        TOG('order', '', ['U', 'NO U'], { x: 58, y: 76, orient: 'h', virtual: true }),
        FOOT({ action: 'param', p: 'odOn', toggle: true, x: 40, y: 178, r: 12, label: 'OD', labelDy: -20, def: 1 }),
        FOOT({ action: 'param', p: 'fzOn', toggle: true, x: 160, y: 178, r: 12, label: 'FUZZ', labelDy: -20, def: 0 }),
        LED({ x: 68, y: 178, bind: 'param:odOn', color: '#ff3fa4' }), LED({ x: 132, y: 178, bind: 'param:fzOn', color: '#3ff0ff' }),
      ],
      alwaysOn: true, initParams: { odOn: 1, fzOn: 0 },
      derive: (u) => {
        const od = u.odOn ?? 1, rev = (u.order | 0) === 1;
        const o = { 'o.on': rev ? 0 : od, 'p.on': rev ? od : 0, 'f.on': u.fzOn ?? 0 };
        for (const k of ['level', 'tone', 'gain']) o['p.' + k] = u['o.' + k] ?? 0.5;
        o['f.tone'] = 0.55;
        return o;
      },
      desc: 'Two pedals in one, each on its own footswitch: a screamer-style overdrive (SCREAM is its volume) and a thick fuzz (SHOUT is its volume, ATTACK its gain). U / NO U flips the order.',
    }),
  ]);
}
