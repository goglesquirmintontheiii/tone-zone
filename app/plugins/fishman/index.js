// Built-in Tone Zone plugin: Fishman.
// Acoustic preamp / DIs, AFX-style acoustic effects and a small acoustic combo inspired by Fishman gear.
// Names, logos and artwork are Tone Zone originals; control layouts follow the real units (see `ref`).
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SCREEN, def, db, ms } = tz.helpers;
  const { compact, AMP, k } = tz.builders;
  const at = (c, x, y, o = {}) => Object.assign(c, { x, y }, o);
  const dB = (lo, hi, d = 0) => ({ min: lo, max: hi, def: d, display: db });

  // ---------------------------------------------------------------- enclosure: black die-cast floor box with a
  // brushed-aluminium control plate, blue "fish-scale" wave art and a printed tuner window.
  tz.addForm('fm-box', (ctx, d) => {
    const { svg, label, formKit } = tz.gfx;
    const g = ctx.g, w = d.fw || 200, h = d.fh || 226, rx = 9;
    formKit.body(g, w, h, d.color || '#161719', { rx });
    const ph = d.plateH ?? 116;
    // brushed control plate
    svg('rect', { x: 6, y: 18, width: w - 12, height: ph, rx: 5, fill: d.plate || '#b9bec4' }, g);
    svg('rect', { x: 6, y: 18, width: w - 12, height: ph, rx: 5, fill: 'url(#p-brushed)' }, g);
    svg('rect', { x: 6, y: 18, width: w - 12, height: ph, rx: 5, fill: 'url(#g-shadeV)', opacity: 0.5 }, g);
    svg('rect', { x: 6, y: 18, width: w - 12, height: ph, rx: 5, fill: 'none', stroke: '#000', 'stroke-opacity': 0.5 }, g);
    // wave art on the lower body
    const acc = d.accent || '#2f7fd6';
    for (let i = 0; i < 3; i++) {
      const y = ph + 30 + i * 5;
      svg('path', { d: `M10 ${y} Q ${w * 0.25} ${y - 6} ${w * 0.5} ${y} T ${w - 10} ${y}`, fill: 'none', stroke: acc, 'stroke-width': 1.1, opacity: 0.85 - i * 0.25 }, g);
    }
    label(g, d.logoX ?? 14, ph + 52, d.logo, { size: d.logoSize || 14, fill: '#f2f2f2', weight: 800, ls: 0.8, anchor: 'start', font: "'Inter', sans-serif" });
    label(g, d.logoX ?? 14, ph + 63, d.tagline || '', { size: 5.2, fill: acc, weight: 700, ls: 1.4, anchor: 'start' });
    if (d.tunerWin) {
      const { x, y, w: tw, h: th } = d.tunerWin;
      svg('rect', { x, y, width: tw, height: th, rx: 2.5, fill: '#07090b', stroke: '#000' }, g);
      for (let i = 0; i < 9; i++) svg('rect', { x: x + 6 + i * ((tw - 12) / 9), y: y + th / 2 - 2, width: (tw - 12) / 9 - 2, height: 4, rx: 1, fill: i === 4 ? '#1d5a2a' : '#2a0e0e' }, g);
      label(g, x + tw / 2, y + th + 5, 'TUNER', { size: 4.6, fill: '#ddd', weight: 700, ls: 1.4 });
    }
    formKit.tzBadge(g, 36, h - 9, '#ddd', 4.2);
    const theme = { text: d.text || '#151618', knob: d.knob || 'chicken', labelSize: 6, labelLs: 0.5 };
    // controls on the plate use dark text, footswitch labels light text: draw in two passes
    const onPlate = d.controls.filter((c) => c.y !== undefined && c.y < 18 + ph);
    const below = d.controls.filter((c) => !onPlate.includes(c));
    formKit.placeControls(ctx, onPlate, theme);
    formKit.placeControls(ctx, below, Object.assign({}, theme, { text: '#e8e8e8' }));
    const jacks = formKit.jacksTop(d, w, { flip: ctx.flip });
    return { w, h, theme: Object.assign({}, theme, { jackText: '#ddd' }), jacks };
  });

  const F = (o) => def(Object.assign({ form: 'fm-box', brand: 'Fishman', cat: 'Acoustic', color: '#17181a' }, o));
  const DI_PORTS = { ins: ['INPUT'], outs: ['XLR DI OUT', '1/4" OUT'] };

  // ToneDEQ effect section: 0 reverb 1, 1 reverb 2 (hall), 2 chorus, 3 delay, 4 echo + reverb
  const deqFx = (p) => {
    const sel = p.fxsel ?? 0, amt = p.fxamt ?? 0.35, par = p.fxpar ?? 0.5, on = (p.fx ?? 1) > 0.5;
    return {
      'rv.on': on && (sel <= 1 || sel === 4) ? 1 : 0, 'rv.mode': sel === 1 ? 1 : 0, 'rv.mix': amt * (sel === 4 ? 0.6 : 0.8), 'rv.decay': 0.2 + 0.7 * par,
      'ch.on': on && sel === 2 ? 1 : 0, 'ch.mix': 0.2 + 0.6 * amt, 'ch.rate': 0.1 + 0.6 * par, 'ch.depth': 0.45,
      'dl.on': on && sel >= 3 ? 1 : 0, 'dl.mix': amt * 0.7, 'dl.time': 80 + 820 * par, 'dl.feedback': sel === 4 ? 0.25 : 0.35,
      'm.level': p.mute ? -60 : p.vol ?? 0,
    };
  };

  tz.addDefs([
    // ---------------------------------------------------------------- Platinum Pro EQ / DI
    F({
      id: 'fm.platpro', name: 'Platinum Plus EQ/DI', ref: 'Fishman Platinum Pro EQ/DI', logo: 'PLATINUM+', tagline: 'ANALOG PREAMP · EQ · DI', typeName: 'Acoustic preamp / EQ / DI',
      fw: 252, fh: 232, plateH: 118, tunerWin: { x: 160, y: 108, w: 76, h: 12 },
      ports: DI_PORTS, jackKinds: { o0: 'xlr' }, alwaysOn: true, cost: 1.3,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'acoustic', opts: { mode: 2 }, params: { mode: 2, body: 0.25 } },
        { prefix: 'm', algo: 'utility', opts: { kind: 'gain' } },
      ] },
      controls: [
        at(K('gain', 'GAIN', dB(-12, 12, 0)), 28, 46, { r: 11, virtual: true }),
        at(K('a.comp', 'COMP', { def: 0.2 }), 68, 46, { r: 10 }),
        at(K('a.bass', 'BASS'), 106, 46, { r: 10 }),
        at(K('a.mid', 'MIDDLE'), 144, 46, { r: 10 }),
        at(K('a.midfreq', 'FREQ'), 182, 46, { r: 9 }),
        at(K('a.treble', 'TREBLE'), 222, 46, { r: 10 }),
        at(K('a.presence', 'BRILLIANCE'), 28, 94, { r: 10 }),
        at(K('a.notch', 'NOTCH', { def: 0 }), 68, 94, { r: 10 }),
        at(K('boostdb', 'BOOST', { min: 0, max: 12, def: 6, display: db, virtual: true }), 106, 94, { r: 10 }),
        at(K('vol', 'VOLUME', dB(-24, 6, -3)), 144, 94, { r: 11, virtual: true }),
        at(TOG('a.phase', 'PHASE', ['0°', '180°']), 198, 90, { orient: 'h' }),
        at(FOOT({ action: 'param', p: 'mute', label: 'TUNE / MUTE', style: 'stomp', r: 12 }), 186, 196),
        at(FOOT({ action: 'param', p: 'boost', label: 'BOOST', style: 'stomp', r: 12 }), 228, 196, { r: 11 }),
        at(LED({ bind: 'param:mute', color: '#ff3020', r: 2.6 }), 186, 172),
        at(LED({ bind: 'param:boost', color: '#3ddc84', r: 2.6 }), 228, 172),
      ],
      initParams: { mute: 0, boost: 0 },
      derive: (p) => ({ 'm.level': p.mute ? -60 : (p.vol ?? -3) + (p.gain ?? 0) + (p.boost ? p.boostdb ?? 6 : 0) }),
      desc: 'Acoustic preamp with COMP, a 4-band EQ (sweepable MIDDLE), NOTCH (fully left is off), PHASE, a BOOST footswitch and TUNE / MUTE.',
    }),
    // ---------------------------------------------------------------- ToneDEQ
    F({
      id: 'fm.tonedeq', name: 'Tone Deck EQ', ref: 'Fishman ToneDEQ', logo: 'TONE DECK', tagline: 'PREAMP EQ · DI · EFFECTS', typeName: 'Acoustic preamp with effects',
      fw: 252, fh: 232, plateH: 118, tunerWin: { x: 160, y: 108, w: 76, h: 12 }, accent: '#e0a43a',
      ports: { ins: ['INPUT'], outs: ['XLR DI OUT', '1/4" OUT'] }, jackKinds: { o0: 'xlr' }, alwaysOn: true, cost: 2.2,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'acoustic', opts: { mode: 2 }, params: { mode: 2, body: 0.25 } },
        { prefix: 'ch', algo: 'chorus', on: false, params: { tone: 0.65 } },
        { prefix: 'dl', algo: 'delay', on: false, opts: { maxMs: 1000 }, params: { mode: 0, tone: 0.55 } },
        { prefix: 'rv', algo: 'reverb', params: { mode: 0, size: 0.5 } },
        { prefix: 'm', algo: 'utility', opts: { kind: 'gain' } },
      ] },
      controls: [
        at(K('a.level', 'GAIN', dB(-12, 12, 0)), 28, 46, { r: 11 }),
        at(K('a.bass', 'BASS'), 68, 46, { r: 10 }),
        at(K('a.mid', 'MID'), 106, 46, { r: 10 }),
        at(K('a.midfreq', 'FREQ'), 144, 46, { r: 9 }),
        at(K('a.treble', 'TREBLE'), 182, 46, { r: 10 }),
        at(K('a.notch', 'NOTCH', { def: 0 }), 222, 46, { r: 10 }),
        at(SEL('fxsel', 'EFFECT', ['REV 1', 'REV 2', 'CHO', 'DLY', 'ECHO+R'], { sweep: 160, optSize: 4.4 }), 30, 98, { r: 10, labelPos: 'below' }),
        at(K('fxpar', 'FX ADJ', { def: 0.5, virtual: true }), 76, 94, { r: 10 }),
        at(K('fxamt', 'FX LEVEL', { def: 0.35, virtual: true }), 116, 94, { r: 10 }),
        at(K('vol', 'VOLUME', dB(-24, 6, 0)), 156, 94, { r: 11, virtual: true }),
        at(TOG('a.phase', 'PHASE', ['0°', '180°']), 206, 90, { orient: 'h' }),
        at(FOOT({ action: 'param', p: 'mute', label: 'TUNE / MUTE', style: 'stomp', r: 12 }), 186, 196),
        at(FOOT({ action: 'param', p: 'fx', label: 'EFFECT', style: 'stomp', r: 11 }), 228, 196),
        at(LED({ bind: 'param:mute', color: '#ff3020', r: 2.6 }), 186, 172),
        at(LED({ bind: 'param:fx', color: '#ffb347', r: 2.6 }), 228, 172),
      ],
      initParams: { mute: 0, fx: 1 },
      derive: deqFx,
      desc: 'Acoustic preamp / DI with five effects (two reverbs, chorus, delay, echo + reverb). FX ADJ sets the time or rate, FX LEVEL the amount, and the EFFECT footswitch turns it on and off.',
    }),
    // ---------------------------------------------------------------- Aura Spectrum DI
    F({
      id: 'fm.auraspectrum', name: 'Halo Spectrum DI', ref: 'Fishman Aura Spectrum DI', logo: 'HALO SPECTRUM', logoSize: 10, tagline: 'ACOUSTIC IMAGING DI', typeName: 'Acoustic imaging preamp / DI',
      fw: 210, fh: 232, plateH: 118, accent: '#3fb0e8', ports: DI_PORTS, jackKinds: { o0: 'xlr' }, cost: 1.3,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'acoustic', opts: { mode: 1 }, params: { mode: 1, body: 0.7, mix: 0.7 } },
        { prefix: 'm', algo: 'utility', opts: { kind: 'gain' } },
      ] },
      controls: [
        at(SCREEN('modelName', { names: ['DREADNOUGHT', 'JUMBO', 'PARLOR', 'NYLON CLASSIC', '12-STRING'] }), 64, 34, { w: 100, h: 14 }),
        at(SEL('model', 'IMAGE', ['DRD', 'JMB', 'PRL', 'NYL', '12S'], { sweep: 160, optSize: 4.4 }), 160, 40, { r: 10, labelPos: 'below' }),
        at(K('a.mix', 'BLEND', { def: 0.7 }), 30, 76, { r: 10 }),
        at(K('a.comp', 'COMP', { def: 0.2 }), 68, 76, { r: 10 }),
        at(K('a.bass', 'BASS'), 106, 76, { r: 10 }),
        at(K('a.mid', 'MID'), 30, 112, { r: 8, labelPos: 'below' }),
        at(K('a.treble', 'TREBLE'), 68, 112, { r: 8, labelPos: 'below' }),
        at(K('vol', 'VOLUME', dB(-24, 6, -2)), 106, 112, { r: 8, labelPos: 'below', virtual: true }),
        at(BTN('ANTI-FB', { p: 'a.antifb', toggle: true, led: true, ledColor: '#3fb0e8', ledDy: -9 }), 160, 92),
        at(FOOT({ action: 'param', p: 'mute', label: 'MUTE', style: 'stomp', r: 11 }), 140, 196),
        at(FOOT({ action: 'bypass', label: 'IMAGE', style: 'stomp', r: 11 }), 184, 196),
        at(LED({ bind: 'param:mute', color: '#ff3020', r: 2.6 }), 140, 172),
        at(LED({ bind: 'on', color: '#3fb0e8', r: 2.6 }), 184, 172),
      ],
      initParams: { mute: 0 },
      derive: (p) => ({ 'a.type': p.model ?? 0, 'm.level': p.mute ? -60 : p.vol ?? -2 }),
      desc: 'Acoustic DI that makes an under-saddle pickup sound more like a miked guitar (approximated). IMAGE picks the body, BLEND mixes it with the raw pickup, ANTI-FB adds automatic feedback notches.',
    }),
    // ---------------------------------------------------------------- AFX compact pedals
    compact({
      id: 'fm.bluechorus', name: 'Azure Chorus', ref: 'Fishman AFX BlueChorus', brand: 'Fishman', code: 'AZ-CHO', typeName: 'Acoustic Chorus', cat: 'Modulation', color: '#1f5fb4', text: '#f0f4fa', labelBg: '#0d1a2c', codeColor: '#7fb6ff', led: '#4aa8ff',
      algo: 'chorus', stereo: 'both', fixed: { tone: 0.7, level: 0.42 },
      controls: [K('rate', 'SPEED', { def: 0.3 }), K('depth', 'DEPTH', { def: 0.45 }), K('mix', 'LEVEL', { def: 0.5 }), BTN('VIBRATO', { p: 'vib', toggle: true, led: true, ledColor: '#4aa8ff', ledDy: -9 })],
      derive: (p) => ({ mode: p.vib ? 1 : 0, mix: p.vib ? 1 : p.mix ?? 0.5 }),
      desc: 'Clear, wide acoustic chorus; VIBRATO button switches to pitch vibrato.',
    }),
    compact({
      id: 'fm.echoback', name: 'Echo Return', ref: 'Fishman AFX EchoBack', brand: 'Fishman', code: 'EC-RTN', typeName: 'Acoustic Delay', cat: 'Delay', color: '#7c1f2a', text: '#f6eef0', labelBg: '#1c0b0e', codeColor: '#ff8a8a', led: '#ff2a1a',
      algo: 'delay', stereo: 'both', opts: { maxMs: 1000 }, fixed: { mode: 0 },
      controls: [K('time', 'TIME', { min: 40, max: 1000, def: 380, display: ms }), K('feedback', 'REPEATS', { def: 0.35 }), K('tone', 'TONE', { def: 0.6 }), K('mix', 'LEVEL', { def: 0.35 })],
      desc: 'Clean digital echo for acoustic instruments; TONE darkens the repeats.',
    }),
    // ---------------------------------------------------------------- Loudbox Mini
    AMP({
      id: 'fm.amp-loudboxmini', name: 'Loud Crate Mini', ref: 'Fishman Loudbox Mini', brand: 'Fishman', cat: 'Amp', typeName: 'Acoustic combo',
      combo: true, speakers: 1, tolex: '#5b3d26', panel: '#1d1b19', panelText: '#e9e2d6', grille: 'brown', logo: 'Loud Crate', logoFont: "'Inter', sans-serif", logoColor: '#efe6d6', logoSize: 22, knob: 'chicken',
      algo: 'chain', cost: 2.4, fixed: { 'a.level': -5 },
      ports: { ins: ['INSTRUMENT'], outs: ['SPEAKER OUT', 'XLR DI OUT'] }, jackKinds: { o1: 'xlr' },
      opts: { chain: [
        { prefix: 'a', algo: 'amp', opts: { voice: { base: 'acoustic', baxBass: 110, baxMid: 800, baxTreble: 5000, inHp: 50 } }, params: { gain: 0.5, master: 0.6 } },
        { prefix: 'c', algo: 'chorus', on: false, params: { mix: 0.45, rate: 0.3, depth: 0.4, tone: 0.65 } },
        { prefix: 'r', algo: 'reverb', params: { mode: 1, mix: 0.2, decay: 0.45, size: 0.45 } },
      ] },
      controls: [k('a.gain', 'LEVEL'), k('a.bass', 'BASS'), k('a.mid', 'MID'), k('a.treble', 'TREBLE'), k('chorus', 'CHORUS', { def: 0, virtual: true }), k('r.mix', 'REVERB', { def: 0.2, max: 0.7 }), k('a.master', 'MASTER', { def: 0.6 })],
      derive: (p) => ({ 'c.on': (p.chorus ?? 0) > 0.03 ? 1 : 0, 'c.mix': 0.2 + 0.6 * (p.chorus ?? 0) }),
      desc: 'Compact clean acoustic combo (instrument channel) with chorus and reverb; the XLR DI out carries the same signal.',
    }),
  ]);
}
