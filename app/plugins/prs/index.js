// Built-in Tone Zone plugin: PRS.
// Pedals, amp heads (+ matching preamps) and V30 cabinets inspired by PRS Guitars gear. Names, logos and
// artwork are Tone Zone originals; control layouts and colours follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { AMP, CAB, preampPair, k } = tz.builders;
  const at = (c, x, y, o = {}) => Object.assign(c, { x, y }, o);
  const ensure = (id, make) => {
    if (document.getElementById(id)) return;
    const holder = document.getElementById('p-grain')?.parentNode;
    if (holder) make(holder);
  };

  // ---------------------------------------------------------------- enclosure: wrinkle-textured housing with an
  // individually etched metal top panel carrying the name and a flight of "inlay" birds.
  tz.addForm('prs-box', (ctx, d) => {
    const { svg, label, formKit, noisePattern, shade } = tz.gfx;
    ensure('prs-wrinkle', (defs) => noisePattern(defs, 'prs-wrinkle', 22, 64, [0, 0, 0], 0, 0.35, 1));
    ensure('prs-etch', (defs) => noisePattern(defs, 'prs-etch', 40, 80, [255, 255, 255], 0, 0.18, 0));
    const g = ctx.g, w = d.fw || 132, h = d.fh || 196, rx = 8;
    formKit.body(g, w, h, d.color, { rx });
    svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: 'url(#prs-wrinkle)' }, g);
    // etched plate
    const py = d.plateY ?? 104, ph = d.plateH ?? 44;
    svg('rect', { x: 8, y: py, width: w - 16, height: ph, rx: 3, fill: d.plate || '#b9a46a' }, g);
    svg('rect', { x: 8, y: py, width: w - 16, height: ph, rx: 3, fill: 'url(#p-brushed)', opacity: 0.8 }, g);
    svg('rect', { x: 8, y: py, width: w - 16, height: ph, rx: 3, fill: 'url(#prs-etch)' }, g);
    svg('rect', { x: 10.5, y: py + 2.5, width: w - 21, height: ph - 5, rx: 2, fill: 'none', stroke: shade(d.plate || '#b9a46a', -0.5), 'stroke-width': 0.7 }, g);
    for (const [x, y] of [[13, py + 5], [w - 13, py + 5], [13, py + ph - 5], [w - 13, py + ph - 5]]) svg('circle', { cx: x, cy: y, r: 1.4, fill: shade(d.plate || '#b9a46a', -0.4) }, g);
    // inlay birds (etched outlines)
    const ink = shade(d.plate || '#b9a46a', -0.6);
    const bird = (x, y, s) => svg('path', { d: `M${x} ${y} q ${3 * s} ${-3.2 * s} ${6 * s} ${-0.4 * s} q ${1.2 * s} ${1 * s} ${2 * s} ${1.6 * s} q ${0.8 * s} ${-0.8 * s} ${2 * s} ${-1.6 * s} q ${3 * s} ${-2.8 * s} ${6 * s} ${0.4 * s} q ${-3.4 * s} ${-0.6 * s} ${-6.4 * s} ${2.4 * s} l ${-1.6 * s} ${1.4 * s} l ${-1.6 * s} ${-1.4 * s} q ${-3 * s} ${-3 * s} ${-6.4 * s} ${-2.4 * s} z`, fill: 'none', stroke: ink, 'stroke-width': 0.7 }, g);
    bird(w - 44, py + 12, 0.75); bird(w - 30, py + 9, 0.55); bird(w - 54, py + 7, 0.45);
    label(g, 16, py + ph / 2 + 1, d.logo, { size: d.logoSize || 13, fill: ink, weight: 700, anchor: 'start', font: "'Dancing Script', cursive" });
    label(g, 16, py + ph - 8, d.tagline || '', { size: 4.6, fill: ink, weight: 800, ls: 1.2, anchor: 'start' });
    formKit.tzBadge(g, w / 2, h - 8, d.text || '#e9e4d6', 4);
    const theme = { text: d.text || '#efe9da', knob: d.knob || 'chicken', labelSize: 5.8, labelLs: 0.5 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  const P = (o) => def(Object.assign({ form: 'prs-box', brand: 'PRS' }, o));

  // ---------------------------------------------------------------- amp voices
  const archon = { base: '5150', stack: 'peavey', tight: 0.55, presHz: 3800, depthHz: 85, sag: 0.3, drive: 1.05 };
  const mt15 = { base: 'recto', stack: 'mesa', tight: 0.45, sag: 0.45, otLp: 6000, drive: 0.95, pwrH: 1.6 };
  const hdrx = { base: 'plexi', stack: 'marshall', drive: 1.15, brightHz: 2400, brightDb: 6, sag: 0.45, pwrH: 1.5, presHz: 3300 };
  const sonClean = { base: 'deluxe', stack: 'fender', brightDb: 4, pwrH: 2.4, sag: 0.3 };
  const sonLead = { base: 'jcm800', stack: 'marshall', drive: 1.1, tight: 0.35, presHz: 3500, sag: 0.35 };
  const panel = { tolex: '#151515', panel: '#141414', panelText: '#e9e2cf', grille: 'black', logoFont: "'Dancing Script', cursive", logoColor: '#d9c58f' };

  // amp + matching preamp with output trims so both sit near unity on a clean riff
  const pair = (a, ampTrim, preTrim) => {
    const [amp, pre] = preampPair(a);
    amp.fixed = Object.assign({}, amp.fixed, { level: ampTrim });
    const out = pre.controls.find((c) => c.p === 'level');
    if (out) out.def = preTrim;
    return [amp, pre];
  };
  tz.addDefs([
    // ================================================================ pedals
    P({
      id: 'prs.wttt', name: 'Wind in the Pines', ref: 'PRS Wind Through The Trees', cat: 'Modulation', logo: 'Wind in the Pines', logoSize: 12, tagline: 'DUAL ANALOG FLANGER', typeName: 'Dual-LFO flanger',
      color: '#2f4a2e', plate: '#c8b47a', fw: 180, fh: 240, plateY: 150, plateH: 40, stereo: 'both', cost: 1.0,
      algo: 'chain', opts: { chain: [
        { prefix: 'f1', algo: 'flanger', params: { mode: 0 } }, { prefix: 'f2', algo: 'flanger', params: { mode: 0 } },
        { prefix: 'q', algo: 'peq', params: { highfreq: 4500, level: 3.5 } },
      ] },
      controls: [
        at(K('f1.manual', 'MANUAL 1', { def: 0.45 }), 34, 40, { r: 10 }), at(K('f1.width', 'DEPTH 1', { def: 0.6 }), 90, 40, { r: 10 }), at(K('f1.speed', 'RATE 1', { def: 0.25 }), 146, 40, { r: 10 }),
        at(K('f2.manual', 'MANUAL 2', { def: 0.6 }), 34, 84, { r: 10 }), at(K('f2.width', 'DEPTH 2', { def: 0.5 }), 90, 84, { r: 10 }), at(K('f2.speed', 'RATE 2', { def: 0.55 }), 146, 84, { r: 10 }),
        at(K('blend', 'MIX 1·2', { def: 0.5, virtual: true }), 28, 128, { r: 9 }), at(K('regen', 'REGEN', { def: 0.55, virtual: true }), 70, 128, { r: 9 }),
        at(K('highs', 'HIGHS', { def: 0.3, virtual: true }), 112, 128, { r: 9 }), at(K('wet', 'DRY/WET', { def: 0.5, virtual: true }), 154, 128, { r: 9 }),
        at(LED({ bind: 'rate:on:f1.speed', color: '#ffb000', r: 2.2 }), 166, 26), at(LED({ bind: 'rate:on:f2.speed', color: '#ffb000', r: 2.2 }), 166, 70),
        at(FOOT({ style: 'stomp', r: 12 }), 90, 214), at(LED({ color: '#ff2a1a', r: 2.6 }), 130, 214),
      ],
      derive: (p) => {
        const b = p.blend ?? 0.5, wet = p.wet ?? 0.5, rg = 0.15 + 0.8 * (p.regen ?? 0.55);
        return { 'f1.mix': wet * (1 - b) * 1.6 > 1 ? 1 : wet * (1 - b) * 1.6, 'f2.mix': Math.min(1, wet * b * 1.6), 'f1.regen': rg, 'f2.regen': rg, 'q.highgain': 9 * (p.highs ?? 0.3) };
      },
      desc: 'Two flangers with independent MANUAL / DEPTH / RATE (LFO 1 and LFO 2), MIX 1·2 balances them, REGEN, added HIGHS and global DRY/WET. (The two flangers run in series here; on the original they run in parallel.)',
    }),
    P({
      id: 'prs.horsemeat', name: 'Horse Feathers', ref: 'PRS Horsemeat', cat: 'Overdrive', logo: 'Horse Feathers', logoSize: 12, tagline: 'TRANSPARENT OVERDRIVE', typeName: 'Transparent overdrive',
      color: '#7a5a2a', plate: '#d8c9a0', fw: 140, fh: 206,
      algo: 'drive', opts: { clip: 'si', cleanSum: true, cleanMix: 0.3, preHp: 70, gainMinDb: 2, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 10, bassF: 110, midF: 800, trebleF: 2800, postLp: 9500, levelMaxDb: 9 },
      controls: [
        at(K('gain', 'GAIN', { def: 0.4 }), 70, 42, { r: 15 }),
        at(K('level', 'LEVEL', { def: 0.43 }), 22, 84, { r: 9 }), at(K('mid', 'VOICE'), 54, 84, { r: 9 }), at(K('treble', 'TREBLE'), 86, 84, { r: 9 }), at(K('bass', 'BASS'), 118, 84, { r: 9 }),
        at(LED({ color: '#ff2a1a', r: 2.6 }), 70, 157), at(FOOT({ style: 'stomp', r: 12 }), 70, 178),
      ],
      plateY: 106,
      desc: 'Transparent drive with clean blend: VOICE moves the mid emphasis, BASS / TREBLE shape the response.',
    }),
    P({
      id: 'prs.marycries', name: 'Mary Weeps', ref: 'PRS Mary Cries', cat: 'Dynamics', logo: 'Mary Weeps', logoSize: 14, tagline: 'OPTICAL COMPRESSOR', typeName: 'Optical compressor',
      color: '#2a3f6a', plate: '#c3c8cf', fw: 140, fh: 206,
      algo: 'comp', opts: { type: 'opto' }, fixed: { attack: 0.3, release: 0.45, blend: 1 },
      controls: [
        at(K('sustain', 'COMP', { def: 0.5 }), 70, 48, { r: 17, labelPos: 'none' }),
        at(K('level', 'GAIN', { def: 0.3 }), 70, 48, { r: 9.5, labelPos: 'none', style: 'white' }),
        at(LED({ bind: 'on', color: '#ffd23f', r: 2.8, label: 'COMP · GAIN', textColor: '#efe9da' }), 70, 84),
        at(LED({ color: '#ff2a1a', r: 2.6 }), 70, 157), at(FOOT({ style: 'stomp', r: 12 }), 70, 178),
      ],
      desc: 'Opto compressor with stacked controls: outer ring = COMPRESSION, inner cap = output GAIN.',
    }),
    P({
      id: 'prs.dirtybastard', name: 'Dirty Rascal', ref: 'PRS Dirty Bastard', cat: 'Overdrive', logo: 'Dirty Rascal', logoSize: 13, tagline: 'BRIT OVERDRIVE', typeName: 'Hot-rodded Brit overdrive',
      color: '#4a1c1c', plate: '#b9a46a', fw: 140, fh: 206,
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, stages: 2, stage2Db: 10, preHp: 90, gainMinDb: 6, gainMaxDb: 44, tone: 'lp', toneLo: 1400, toneHi: 9000, postLp: 8500, levelMaxDb: 6, outTrim: 0.5,
        modes: [{}, { preEq: [{ type: 'peak', f: 800, q: 0.8, db: 4 }] }, { stages: 3, gainMaxDb: 50 }] },
      controls: [
        at(K('level', 'VOLUME', { def: 0.39 }), 28, 42, { r: 11 }), at(K('tone', 'TONE'), 70, 42, { r: 11 }), at(K('gain', 'GAIN', { def: 0.45 }), 112, 42, { r: 11 }),
        at(TOG('mode', 'VOICE', ['I', 'II', 'III']), 70, 84, { orient: 'h' }),
        at(LED({ color: '#ff2a1a', r: 2.6 }), 70, 157), at(FOOT({ style: 'stomp', r: 12 }), 70, 178),
      ],
      desc: 'Amp-style Brit overdrive with a three-way VOICE switch (classic, mid push, more gain).',
    }),
    // ================================================================ amps (+ matching preamps)
    pair(AMP({ id: 'prs.amp-archon', name: 'Archer 100', ref: 'PRS Archon 100', typeName: 'High-gain head', opts: { voice: archon }, ...panel, logo: 'Archer', knob: 'chrome',
      controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('depth', 'DEPTH'), k('master', 'MASTER'), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Modern high-gain head: tight low end, aggressive mids, DEPTH and PRESENCE on the power amp.' }), -9.5, -8),
    pair(AMP({ id: 'prs.amp-mt15', name: 'MX-15 Lead', ref: 'PRS MT 15 (Mark Tremonti)', typeName: '15 W high-gain head', opts: { voice: mt15 }, ...panel, panel: '#1c1c1c', logo: 'MX 15', knob: 'chicken',
      controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('master', 'VOLUME')],
      desc: 'Compact 15-watt lead head with a thick, saturated rectifier-style voice.' }), -10, -8),
    pair(AMP({ id: 'prs.amp-hdrx', name: 'Hound DX 100', ref: 'PRS HDRX 100', typeName: 'Plexi-style head', opts: { voice: hdrx }, ...panel, panel: '#c9b27a', panelText: '#1a140a', logo: 'Hound DX', logoColor: '#efe2bd', knob: 'chicken',
      controls: [k('presence', 'PRESENCE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('gain', 'VOLUME'), k('master', 'MASTER', { def: 0.6 }), TOG('bright', 'BRIGHT', ['HI', 'LO'], { values: [1, 0] })],
      desc: 'Hot-rodded plexi voice: more gain than the original, bright switch, master volume.' }), -8, -3.5),
    pair(AMP({ id: 'prs.amp-sonzera', name: 'Sonora 50', ref: 'PRS Sonzera 50', typeName: '2-channel head', opts: { models: [sonClean, sonLead] }, ...panel, logo: 'Sonora', knob: 'chrome',
      controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('master', 'MASTER'), TOG('channel', 'CHANNEL', ['CLEAN', 'LEAD'])],
      desc: 'Two-channel head: chimey Fender-ish clean and a Brit lead channel.' }), -2.5, -3),
    // ================================================================ cabs
    CAB({ id: 'prs.cab-212v30', name: '2x12 Bird V30', ref: 'PRS 2x12 (Celestion V30)', brand: 'PRS', typeName: '2x12 closed back V30', cabSize: '2x12', grille: 'black', logo: 'Bird 212', logoColor: '#d9c58f',
      opts: { cab: { hp: 78, hpQ: 0.9, resDb: 4, lp: 5300, lpQ: 0.8, open: false, peaks: [[2500, 1.5, 4], [1200, 1.2, -2], [150, 1.0, 1.5]], seed: 7, detail: 1.5 } } }),
    CAB({ id: 'prs.cab-412v30', name: '4x12 Bird V30', ref: 'PRS 4x12 (Celestion V30)', brand: 'PRS', typeName: '4x12 closed back V30', cabSize: '4x12', grille: 'black', logo: 'Bird 412', logoColor: '#d9c58f',
      opts: { cab: { hp: 68, hpQ: 1.0, resDb: 5, lp: 5000, lpQ: 0.85, open: false, peaks: [[2600, 1.6, 4.5], [1300, 1.2, -2.5], [110, 1.0, 2]], seed: 11, detail: 1.6 } } }),
  ]);
}
