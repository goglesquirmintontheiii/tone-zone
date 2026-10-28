// Built-in Tone Zone plugin: Grace Design.
// Studio-grade acoustic preamp / DIs inspired by Grace Design. Names, logos and artwork are Tone Zone
// originals; control layouts follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, TOG, BTN, FOOT, LED, def, db } = tz.helpers;
  const at = (c, x, y, o = {}) => Object.assign(c, { x, y }, o);
  const dB = (lo, hi, d = 0) => ({ min: lo, max: hi, def: d, display: db });
  const hz = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz');

  // ---------------------------------------------------------------- enclosure: natural (clear) anodised brushed
  // aluminium, black screen printing, thin outlined sections, recessed black header strip.
  tz.addForm('gd-box', (ctx, d) => {
    const { svg, label, formKit } = tz.gfx;
    const g = ctx.g, w = d.fw || 150, h = d.fh || 220, rx = 6;
    formKit.body(g, w, h, d.color || '#c4c8cd', { rx, brushed: true });
    svg('rect', { x: 6, y: 18, width: w - 12, height: 22, rx: 3, fill: '#16181b' }, g);
    svg('rect', { x: 6, y: 18, width: w - 12, height: 22, rx: 3, fill: 'url(#g-gloss)', opacity: 0.25 }, g);
    label(g, 14, 29.5, d.logo, { size: 11, fill: '#f2f2f2', weight: 800, ls: 0.6, anchor: 'start', font: "'Inter', sans-serif" });
    label(g, w - 14, 29.5, d.tagline || '', { size: 5, fill: '#c0c6cc', weight: 700, ls: 1.4, anchor: 'end' });
    for (const f of d.frames || []) {
      svg('rect', { x: f.x, y: f.y, width: f.w, height: f.h, rx: 3, fill: 'none', stroke: '#1b1d20', 'stroke-opacity': 0.55, 'stroke-width': 0.7 }, g);
      if (f.label) label(g, f.x + f.w / 2, f.y + 7, f.label, { size: 5.6, fill: '#1b1d20', weight: 800, ls: 1.6 });
    }
    formKit.tzBadge(g, w / 2, h - 8, '#2a2d31', 4.2);
    const theme = { text: '#16181b', knob: 'chrome', labelSize: 5.8, labelLs: 0.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  const G = (o) => def(Object.assign({ form: 'gd-box', brand: 'Grace Design', cat: 'Acoustic', color: '#c4c8cd' }, o));

  tz.addDefs([
    G({
      id: 'gd.bix', name: 'Bi-X Dual Acoustic Pre', ref: 'Grace Design BiX', logo: 'Bi-X', tagline: 'DUAL CHANNEL ACOUSTIC PREAMP · DI', typeName: 'Dual-channel acoustic preamp / DI',
      fw: 300, fh: 248, alwaysOn: true, cost: 1.4,
      ports: { ins: ['CH 1 IN', 'CH 2 IN'], outs: ['XLR DI OUT', '1/4" OUT'] }, jackKinds: { o0: 'xlr' },
      algo: 'chain', opts: { chain: [
        { prefix: 'm', algo: 'merge', params: { pan1: 0, pan2: 0 } },
        { prefix: 'a', algo: 'acoustic', opts: { mode: 2 }, params: { mode: 2, body: 0 } },
        { prefix: 'q', algo: 'peq', params: { lowfreq: 100, mid1freq: 800, mid1q: 0.8, highfreq: 6000, lowcut: 40 } },
      ] },
      frames: [{ x: 10, y: 48, w: 84, h: 112, label: 'CHANNEL 1' }, { x: 102, y: 48, w: 96, h: 150, label: 'MASTER EQ' }, { x: 206, y: 48, w: 84, h: 112, label: 'CHANNEL 2' }],
      controls: [
        at(K('m.g1', 'GAIN', dB(-24, 12, -3)), 52, 84, { r: 13 }),
        at(TOG('m.inv1', 'Ø', ['0°', '180°']), 34, 136, { orient: 'h' }),
        at(BTN('MUTE', { p: 'm.m1', toggle: true, led: true, ledColor: '#ff3020', ledDy: -9 }), 72, 140),
        at(K('m.g2', 'GAIN', dB(-24, 12, -3)), 248, 84, { r: 13 }),
        at(TOG('m.inv2', 'Ø', ['0°', '180°']), 230, 136, { orient: 'h' }),
        at(BTN('MUTE', { p: 'm.m2', toggle: true, led: true, ledColor: '#ff3020', ledDy: -9 }), 268, 140),
        at(K('q.lowgain', 'BASS', dB(-12, 12, 0)), 122, 78, { r: 9 }),
        at(K('q.mid1gain', 'MID', dB(-12, 12, 0)), 150, 78, { r: 9 }),
        at(K('q.highgain', 'TREBLE', dB(-12, 12, 0)), 178, 78, { r: 9 }),
        at(K('q.mid1freq', 'FREQ', { min: 200, max: 4000, def: 800, curve: 'log', display: hz }), 122, 120, { r: 9 }),
        at(K('a.notch', 'NOTCH', { def: 0 }), 150, 120, { r: 9 }),
        at(K('q.lowcut', 'LO CUT', { min: 20, max: 300, def: 40, curve: 'log', display: hz }), 178, 120, { r: 9 }),
        at(K('vol', 'VOLUME', dB(-24, 6, 0)), 150, 168, { r: 13, virtual: true }),
        at(FOOT({ action: 'param', p: 'mute', label: 'MUTE', style: 'stomp', r: 12 }), 52, 208),
        at(FOOT({ action: 'param', p: 'boost', label: 'BOOST', style: 'stomp', r: 12 }), 248, 208),
        at(LED({ bind: 'param:mute', color: '#ff3020', r: 2.8 }), 52, 180),
        at(LED({ bind: 'param:boost', color: '#3ddc84', r: 2.8 }), 248, 180),
      ],
      initParams: { mute: 0, boost: 0 },
      derive: (p) => ({ 'm.level': p.mute ? -60 : (p.vol ?? 0) + (p.boost ? 6 : 0) }),
      desc: 'Two independent inputs (e.g. pickup + internal mic) with their own GAIN, polarity and mute, mixed into a shared master EQ (bass / sweepable mid / treble, notch, low cut) and a +6 dB footswitchable boost. Note: the EQ is shared by both channels (per-channel EQ needs dual-lane chains).',
    }),
    G({
      id: 'gd.alix', name: 'Ali-X Acoustic Pre', ref: 'Grace Design ALiX', logo: 'Ali-X', tagline: 'ACOUSTIC PREAMP · DI', typeName: 'Acoustic preamp / DI',
      fw: 160, fh: 248, alwaysOn: true, cost: 1.0,
      ports: { ins: ['INPUT'], outs: ['XLR DI OUT', '1/4" OUT'] }, jackKinds: { o0: 'xlr' },
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'acoustic', opts: { mode: 2 }, params: { mode: 2, body: 0.15 } },
        { prefix: 'm', algo: 'utility', opts: { kind: 'gain' } },
      ] },
      frames: [{ x: 10, y: 48, w: 140, h: 150, label: 'PREAMP · EQ' }],
      controls: [
        at(K('a.level', 'GAIN', dB(-12, 12, 0)), 40, 82, { r: 12 }),
        at(K('a.bass', 'BASS'), 80, 82, { r: 9 }),
        at(K('a.treble', 'TREBLE'), 120, 82, { r: 9 }),
        at(K('a.mid', 'MID'), 40, 128, { r: 9 }),
        at(K('a.midfreq', 'FREQ'), 80, 128, { r: 9 }),
        at(K('a.notch', 'NOTCH', { def: 0 }), 120, 128, { r: 9 }),
        at(TOG('a.phase', 'Ø', ['0°', '180°']), 40, 174, { orient: 'h' }),
        at(K('vol', 'VOLUME', dB(-24, 6, 0)), 104, 170, { r: 12, virtual: true }),
        at(FOOT({ action: 'param', p: 'mute', label: 'MUTE', style: 'stomp', r: 12 }), 80, 218),
        at(LED({ bind: 'param:mute', color: '#ff3020', r: 2.8 }), 116, 218),
      ],
      initParams: { mute: 0 },
      derive: (p) => ({ 'm.level': p.mute ? -60 : p.vol ?? 0 }),
      desc: 'Single-channel version: transparent gain, 3-band EQ with sweepable mid, notch and polarity.',
    }),
  ]);
}
