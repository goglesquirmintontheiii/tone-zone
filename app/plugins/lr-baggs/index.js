// Built-in Tone Zone plugin: LR Baggs.
// Acoustic preamps / DIs and Align-style acoustic pedals inspired by LR Baggs gear. Names, logos and artwork
// are Tone Zone originals; control layouts follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, db, ms } = tz.helpers;
  const { def } = tz.helpers;
  const at = (c, x, y, o = {}) => Object.assign(c, { x, y }, o);
  const dB = (lo, hi, d = 0) => ({ min: lo, max: hi, def: d, display: db });

  // ---------------------------------------------------------------- enclosure: matte die-cast with fine speckle,
  // Align series = graphite box with a coloured top band + name window; DI series = black wide box with a
  // sound-hole rosette emblem and framed control sections.
  const ensure = (id, make) => {
    if (document.getElementById(id)) return;
    const holder = document.getElementById('p-grain')?.parentNode;
    if (holder) make(holder);
  };
  tz.addForm('lrb-box', (ctx, d) => {
    const { svg, label, formKit, noisePattern } = tz.gfx;
    ensure('lrb-tex', (defs) => noisePattern(defs, 'lrb-tex', 36, 72, [255, 255, 255], 0, 0.09, 0));
    const g = ctx.g, w = d.fw || 128, h = d.fh || 210, rx = 7;
    const txt = d.text || '#efe6d2';
    formKit.body(g, w, h, d.color, { rx });
    svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: 'url(#lrb-tex)' }, g);
    if (d.series === 'align') {
      svg('path', { d: `M${rx} 0 H${w - rx} Q${w} 0 ${w} ${rx} V9 H0 V${rx} Q0 0 ${rx} 0 Z`, fill: d.accent, opacity: 0.95 }, g);
      const ny = d.nameY ?? 134;
      svg('rect', { x: 10, y: ny - 16, width: w - 20, height: 32, rx: 3, fill: '#000', opacity: 0.28 }, g);
      svg('rect', { x: 10, y: ny + 13, width: w - 20, height: 2.2, fill: d.accent }, g);
      label(g, w / 2, ny - 8, d.series2 || 'ALIGNED SERIES', { size: 5, fill: txt, weight: 700, ls: 2.2, opacity: 0.75 });
      label(g, w / 2, ny + 4, d.logo, { size: d.logoSize || 13, fill: txt, weight: 700, ls: 1.6, font: "'Oswald', sans-serif" });
    } else {
      // rosette emblem (sound hole) + logo
      const ex = d.emblemX ?? 22, ey = d.emblemY ?? h - 74;
      svg('circle', { cx: ex, cy: ey, r: 9.5, fill: 'none', stroke: d.accent, 'stroke-width': 1.2 }, g);
      svg('circle', { cx: ex, cy: ey, r: 7.4, fill: 'none', stroke: d.accent, 'stroke-width': 0.6, 'stroke-dasharray': '1.2 1.1' }, g);
      svg('circle', { cx: ex, cy: ey, r: 5.4, fill: '#070707', stroke: d.accent, 'stroke-width': 0.6 }, g);
      label(g, ex + 15, ey - 3, d.logo, { size: d.logoSize || 13, fill: txt, weight: 700, ls: 1.4, anchor: 'start', font: "'Oswald', sans-serif" });
      label(g, ex + 15, ey + 8, d.tagline || '', { size: 5.2, fill: d.accent, weight: 700, ls: 1.5, anchor: 'start' });
    }
    for (const f of d.frames || []) {
      svg('rect', { x: f.x, y: f.y, width: f.w, height: f.h, rx: 4, fill: 'none', stroke: txt, 'stroke-opacity': 0.28, 'stroke-width': 0.8 }, g);
      if (f.label) {
        const tw = f.label.length * 3.4 + 8;
        svg('rect', { x: f.x + 8, y: f.y - 3.5, width: tw, height: 7, fill: d.color }, g);
        label(g, f.x + 8 + tw / 2, f.y, f.label, { size: 5, fill: d.accent || txt, weight: 700, ls: 1 });
      }
    }
    const bdg = formKit.tzBadge(g, d.badgeX ?? w / 2, h - 8, txt, 4.2);
    if (d.badgeAnchor) bdg.setAttribute('text-anchor', d.badgeAnchor);
    const theme = { text: txt, knob: d.knob || 'chrome', labelSize: d.labelSize || 6, labelLs: 0.6 };
    formKit.placeControls(ctx, d.controls, theme);
    const jacks = d.jacksTop ? formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { flip: ctx.flip, y0: d.jy0 ?? (d.series === 'align' ? 176 : 56), gap: d.jgap ?? 22 });
    return { w, h, theme, jacks };
  });

  const B = (o) => def(Object.assign({ form: 'lrb-box', brand: 'LR Baggs', cat: 'Acoustic' }, o));
  const DI_PORTS = { ins: ['INPUT'], outs: ['XLR DI OUT', '1/4" OUT'] };
  // mute / volume / boost stage at the end of the DI chains
  const outStage = (p, volKey = 'vol') => ({ 'm.level': p.mute ? -60 : (p[volKey] ?? 0) + (p.boost ? p.boostdb ?? 6 : 0) });

  tz.addDefs([
    // ---------------------------------------------------------------- Venue DI
    B({
      id: 'lrb.venue', name: 'Arena DI', ref: 'LR Baggs Venue DI', logo: 'ARENA DI', tagline: 'ACOUSTIC PREAMP · DI · BOOST', typeName: 'Acoustic preamp / DI',
      color: '#18181a', accent: '#c99a4a', fw: 240, fh: 226, jacksTop: true, emblemX: 26, emblemY: 140,
      ports: DI_PORTS, jackKinds: { o0: 'xlr' }, alwaysOn: true, cost: 1.4,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'acoustic', opts: { mode: 2 }, params: { mode: 2, body: 0.3 } },
        { prefix: 'q', algo: 'peq', params: { mid1freq: 220, mid1q: 0.9, mid2freq: 3200, mid2q: 1.0, lowcut: 40 } },
        { prefix: 'm', algo: 'utility', opts: { kind: 'gain' } },
      ] },
      frames: [{ x: 8, y: 22, w: 224, h: 100, label: 'EQ' }],
      controls: [
        at(K('gain', 'GAIN', dB(-12, 12, 0)), 30, 50, { r: 11, virtual: true }),
        at(K('a.bass', 'BASS'), 72, 50, { r: 10 }),
        at(K('q.mid1gain', 'LO MID', dB(-12, 12, 0)), 108, 50, { r: 10 }),
        at(K('a.mid', 'MID'), 144, 50, { r: 10 }),
        at(K('q.mid2gain', 'HI MID', dB(-12, 12, 0)), 180, 50, { r: 10 }),
        at(K('a.treble', 'TREBLE'), 214, 50, { r: 10 }),
        at(K('vol', 'VOLUME', dB(-24, 6, 0)), 30, 96, { r: 12, virtual: true }),
        at(K('a.notch', 'NOTCH', { def: 0 }), 76, 96, { r: 10 }),
        at(K('a.presence', 'PRESENCE'), 120, 96, { r: 10 }),
        at(K('boostdb', 'BOOST', { min: 0, max: 12, def: 6, display: db, virtual: true }), 164, 96, { r: 10 }),
        at(BTN('PHASE', { p: 'a.phase', toggle: true, led: true, ledColor: '#ffb347', ledDy: -9 }), 210, 100),
        at(FOOT({ action: 'param', p: 'mute', label: 'MUTE / TUNE', style: 'stomp', r: 12 }), 64, 188),
        at(FOOT({ action: 'param', p: 'boost', label: 'BOOST', style: 'stomp', r: 12 }), 176, 188),
        at(LED({ bind: 'param:mute', color: '#ff3020', r: 2.8 }), 64, 164),
        at(LED({ bind: 'param:boost', color: '#3ddc84', r: 2.8 }), 176, 164),
      ],
      initParams: { mute: 0, boost: 0 },
      derive: (p) => Object.assign({ 'q.level': p.gain ?? 0 }, outStage(p)),
      desc: 'Five-band acoustic preamp / DI: GAIN, BASS, LO MID (220 Hz), MID, HI MID (3.2 kHz), TREBLE, sweepable NOTCH (fully left = off), PRESENCE, PHASE and a footswitchable BOOST. MUTE silences both outputs (tune silently).',
    }),
    // ---------------------------------------------------------------- Session DI
    B({
      id: 'lrb.sessiondi', name: 'Studio Session DI', ref: 'LR Baggs Session DI', logo: 'SESSION·DI', tagline: 'SATURATE · COMP · EQ · DI', typeName: 'Acoustic studio DI',
      color: '#202022', accent: '#d07a3c', fw: 220, fh: 226, jacksTop: true, emblemX: 26, emblemY: 140,
      ports: DI_PORTS, jackKinds: { o0: 'xlr' }, alwaysOn: true, cost: 1.2,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'acoustic', opts: { mode: 2 }, params: { mode: 2, body: 0.35, saturate: 0.35, comp: 0.35 } },
        { prefix: 'm', algo: 'utility', opts: { kind: 'gain' } },
      ] },
      frames: [{ x: 8, y: 22, w: 204, h: 100, label: 'SESSION' }],
      controls: [
        at(K('a.saturate', 'SATURATE', { def: 0.35 }), 34, 50, { r: 12 }),
        at(K('a.comp', 'COMP', { def: 0.35 }), 78, 50, { r: 10 }),
        at(K('a.bass', 'BASS'), 116, 50, { r: 10 }),
        at(K('a.mid', 'MID'), 152, 50, { r: 10 }),
        at(K('a.treble', 'TREBLE'), 188, 50, { r: 10 }),
        at(K('vol', 'VOLUME', dB(-24, 6, -5)), 34, 96, { r: 12, virtual: true }),
        at(K('a.presence', 'PRESENCE'), 78, 96, { r: 10 }),
        at(K('a.notch', 'NOTCH', { def: 0 }), 116, 96, { r: 10 }),
        at(TOG('a.phase', 'PHASE', ['0°', '180°']), 156, 98, { orient: 'h' }),
        at(TOG('pad', 'PAD', ['0', '-15']), 190, 98, { orient: 'h', values: [0, 1] }),
        at(FOOT({ action: 'param', p: 'mute', label: 'MUTE', style: 'stomp', r: 12 }), 64, 188),
        at(FOOT({ action: 'bypass', label: 'SESSION', style: 'stomp', r: 12 }), 156, 188),
        at(LED({ bind: 'param:mute', color: '#ff3020', r: 2.8 }), 64, 164),
        at(LED({ bind: 'on', color: '#ffb347', r: 2.8 }), 156, 164),
      ],
      initParams: { mute: 0 },
      derive: (p) => ({ 'm.level': p.mute ? -60 : (p.vol ?? -5) - (p.pad ? 15 : 0) }),
      desc: 'Studio-voiced acoustic DI: SATURATE adds tube-style harmonic density, COMP evens out the dynamics; three-band EQ plus presence and notch. SESSION footswitch bypasses the whole processor.',
    }),
    // ---------------------------------------------------------------- Para Acoustic DI
    B({
      id: 'lrb.paradi', name: 'Parametric Acoustic DI', ref: 'LR Baggs Para Acoustic DI', logo: 'PARA·DI', tagline: 'ACOUSTIC DI · PREAMP', typeName: 'Acoustic DI preamp',
      color: '#1a1b1d', accent: '#b8b0a0', fw: 176, fh: 226, jacksTop: true, emblemX: 24, emblemY: 140,
      ports: DI_PORTS, jackKinds: { o0: 'xlr' }, alwaysOn: true, cost: 1.0,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'acoustic', opts: { mode: 2 }, params: { mode: 2, body: 0.25 } },
        { prefix: 'm', algo: 'utility', opts: { kind: 'gain' } },
      ] },
      frames: [{ x: 8, y: 22, w: 160, h: 100, label: 'EQ' }],
      controls: [
        at(K('gain', 'GAIN', dB(-12, 12, 0)), 30, 50, { r: 11, virtual: true }),
        at(K('a.treble', 'TREBLE'), 72, 50, { r: 10 }),
        at(K('a.mid', 'PRESENCE'), 110, 50, { r: 10 }),
        at(K('a.midfreq', 'FREQ'), 146, 50, { r: 9 }),
        at(K('vol', 'VOLUME', dB(-24, 6, 0)), 30, 96, { r: 11, virtual: true }),
        at(K('a.bass', 'BASS'), 72, 96, { r: 10 }),
        at(K('a.notch', 'NOTCH', { def: 0 }), 110, 96, { r: 10 }),
        at(TOG('a.phase', 'PHASE', ['0°', '180°']), 146, 98, { orient: 'h' }),
        at(FOOT({ action: 'param', p: 'mute', label: 'MUTE', style: 'stomp', r: 12 }), 88, 188),
        at(LED({ bind: 'param:mute', color: '#ff3020', r: 2.8 }), 88, 164),
      ],
      initParams: { mute: 0 },
      derive: (p) => ({ 'm.level': p.mute ? -60 : (p.vol ?? 0) + (p.gain ?? 0) }),
      desc: 'Classic acoustic DI with a sweepable PRESENCE band (FREQ), notch filter and phase switch. Footswitch = mute.',
    }),
    // ---------------------------------------------------------------- Voiceprint DI
    B({
      id: 'lrb.voiceprint', name: 'Print Voice DI', ref: 'LR Baggs Voiceprint DI', logo: 'PRINT DI', tagline: 'VOICE-MATCHED ACOUSTIC DI', typeName: 'Body-imaging acoustic DI',
      color: '#1c1d20', accent: '#e0a43a', fw: 168, fh: 226, jacksTop: true, emblemX: 22, emblemY: 140,
      ports: DI_PORTS, jackKinds: { o0: 'xlr' }, cost: 1.2,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'acoustic', opts: { mode: 1 }, params: { mode: 1, body: 0.85, top: 0.6, mix: 0.85 } },
        { prefix: 'm', algo: 'utility', opts: { kind: 'gain' } },
      ] },
      frames: [{ x: 8, y: 22, w: 152, h: 100, label: 'VOICEPRINT' }],
      controls: [
        at(SEL('a.type', 'VOICE', ['1', '2', '3'], { values: [0, 1, 2], sweep: 90, def: 0 }), 34, 54, { r: 11 }),
        at(K('vol', 'VOLUME', dB(-24, 6, 0)), 84, 58, { r: 15, virtual: true }),
        at(K('a.mix', 'BLEND', { def: 0.85 }), 134, 54, { r: 10 }),
        at(K('a.bass', 'BASS'), 34, 100, { r: 9 }),
        at(K('a.treble', 'TREBLE'), 134, 100, { r: 9 }),
        at(BTN('NOTCH', { p: 'a.antifb', toggle: true, led: true, ledColor: '#ffb347', ledDy: -9 }), 84, 104),
        at(FOOT({ action: 'param', p: 'mute', label: 'MUTE', style: 'stomp', r: 11 }), 46, 188),
        at(FOOT({ action: 'bypass', label: 'VOICE', style: 'stomp', r: 11 }), 122, 188),
        at(LED({ bind: 'param:mute', color: '#ff3020', r: 2.8 }), 46, 164),
        at(LED({ bind: 'on', color: '#ffb347', r: 2.8 }), 122, 164),
      ],
      initParams: { mute: 0 },
      derive: (p) => ({ 'm.level': p.mute ? -60 : p.vol ?? 0 }),
      desc: 'Body-imaging DI: rebuilds the resonance of the guitar body that an under-saddle pickup misses (approximated with the piezo-enhance engine and a stronger body). VOICE picks one of three stored body prints, BLEND mixes it with the raw pickup, NOTCH enables automatic feedback notches.',
    }),
    // ---------------------------------------------------------------- Align series
    B({
      id: 'lrb.alignsession', name: 'Aligned Session', ref: 'LR Baggs Align Session', logo: 'SESSION', series: 'align', typeName: 'Acoustic saturation / comp / EQ',
      color: '#2b2c30', accent: '#c47a3a', fw: 140, fh: 214, knob: 'mxr', cost: 0.8,
      algo: 'chain', opts: { chain: [{ prefix: 'a', algo: 'acoustic', opts: { mode: 2 }, params: { mode: 2, body: 0.35, saturate: 0.35, comp: 0.4 } }] },
      controls: [
        at(K('a.level', 'VOLUME', dB(-24, 6, -5)), 30, 40, { r: 11 }),
        at(K('a.saturate', 'SATURATE', { def: 0.35 }), 70, 40, { r: 11 }),
        at(K('a.comp', 'COMP', { def: 0.4 }), 110, 40, { r: 11 }),
        at(K('a.bass', 'BASS'), 30, 90, { r: 11 }),
        at(K('a.presence', 'PRES'), 70, 90, { r: 11 }),
        at(K('a.treble', 'TREBLE'), 110, 90, { r: 11 }),
        at(FOOT({ style: 'stomp', r: 12 }), 70, 184), at(LED({ color: '#ffb347', r: 2.8 }), 70, 162),
      ],
      desc: 'Studio EQ, saturation and compression in a pedal for piezo-equipped acoustics.',
    }),
    B({
      id: 'lrb.alignreverb', name: 'Aligned Reverb', ref: 'LR Baggs Align Reverb', logo: 'REVERB', series: 'align', typeName: 'Acoustic reverb',
      color: '#2b2c30', accent: '#3d79c4', fw: 128, fh: 214, knob: 'mxr', stereo: 'both', cost: 1.0,
      algo: 'reverb', fixed: { mode: 1, size: 0.45, predelay: 14, lowcut: 0.2 },
      controls: [
        at(K('mix', 'REVERB', { def: 0.3 }), 34, 40, { r: 12 }), at(K('decay', 'DECAY', { def: 0.45 }), 94, 40, { r: 12 }),
        at(K('tone', 'TONE', { def: 0.55 }), 34, 92, { r: 12 }), at(K('level', 'VOLUME', { def: 0.5 }), 94, 92, { r: 12 }),
        at(FOOT({ style: 'stomp', r: 12 }), 64, 184), at(LED({ color: '#4aa8ff', r: 2.8 }), 64, 162),
      ],
      desc: 'Natural acoustic room / hall reverb; TONE shapes only the reverb.',
    }),
    B({
      id: 'lrb.alignchorus', name: 'Aligned Chorus', ref: 'LR Baggs Align Chorus', logo: 'CHORUS', series: 'align', typeName: 'Acoustic chorus',
      color: '#2b2c30', accent: '#8a5bc4', fw: 128, fh: 214, knob: 'mxr', stereo: 'both', cost: 0.5,
      algo: 'chorus', fixed: { mode: 0, tone: 0.65 },
      controls: [
        at(K('mix', 'CHORUS', { def: 0.45 }), 34, 40, { r: 12 }), at(K('rate', 'RATE', { def: 0.3 }), 94, 40, { r: 12 }),
        at(K('depth', 'DEPTH', { def: 0.45 }), 34, 92, { r: 12 }), at(K('level', 'VOLUME', { def: 0.4 }), 94, 92, { r: 12 }),
        at(FOOT({ style: 'stomp', r: 12 }), 64, 184), at(LED({ color: '#b98cff', r: 2.8 }), 64, 162),
      ],
      desc: 'Lush, hi-fi chorus voiced for acoustic instruments.',
    }),
    B({
      id: 'lrb.aligneq', name: 'Aligned Equalizer', ref: 'LR Baggs Align Equalizer', logo: 'EQUALIZER', logoSize: 12, series: 'align', typeName: 'Acoustic 5-band EQ', nameY: 168, jy0: 206,
      color: '#2b2c30', accent: '#4aa36a', fw: 140, fh: 242, knob: 'mxr', cost: 0.6,
      algo: 'chain', opts: { chain: [
        { prefix: 'q', algo: 'peq', params: { lowfreq: 90, mid1freq: 250, mid1q: 0.9, mid2freq: 2500, mid2q: 1.0, highfreq: 6500 } },
        { prefix: 'a', algo: 'acoustic', opts: { mode: 2 }, params: { mode: 2, body: 0 } },
      ] },
      controls: [
        at(K('q.lowgain', 'BASS', dB(-12, 12, 0)), 30, 36, { r: 10 }),
        at(K('q.mid1gain', 'LO MID', dB(-12, 12, 0)), 70, 36, { r: 10 }),
        at(K('a.mid', 'MID'), 110, 36, { r: 10 }),
        at(K('q.mid2gain', 'HI MID', dB(-12, 12, 0)), 30, 80, { r: 10 }),
        at(K('q.highgain', 'TREBLE', dB(-12, 12, 0)), 70, 80, { r: 10 }),
        at(K('a.presence', 'PRES'), 110, 80, { r: 10 }),
        at(K('a.notch', 'NOTCH', { def: 0 }), 30, 124, { r: 10, labelPos: 'below' }),
        at(K('a.level', 'VOLUME', dB(-24, 6, 0)), 110, 124, { r: 10, labelPos: 'below' }),
        at(TOG('a.phase', 'PHASE', ['0°', '180°']), 70, 126, { orient: 'h' }),
        at(FOOT({ style: 'stomp', r: 12 }), 70, 212), at(LED({ color: '#3ddc84', r: 2.8 }), 70, 194),
      ],
      desc: 'Five-band acoustic EQ with presence, sweepable notch (fully left = off) and phase.',
    }),
    // Align Active DI (utility)
    B({
      id: 'lrb.alignactivedi', name: 'Aligned Active DI', ref: 'LR Baggs Align Active DI', logo: 'ACTIVE DI', logoSize: 12, series: 'align', typeName: 'Active DI box', cat: 'Utility', kind: 'Utility',
      color: '#2b2c30', accent: '#b8b0a0', fw: 128, fh: 214, knob: 'mxr', cost: 0.1, badgeX: 118, badgeAnchor: 'end',
      algo: 'di', ports: { ins: ['INPUT'], outs: ['XLR DI OUT', 'THRU'] }, jackKinds: { o0: 'xlr' }, alwaysOn: true,
      controls: [
        at(K('vol', 'VOLUME', dB(-24, 12, 6)), 64, 44, { r: 14, virtual: true }),
        at(TOG('invert', 'PHASE', ['0°', '180°']), 36, 92, { orient: 'h' }),
        at(TOG('lift', 'GROUND', ['GND', 'LIFT']), 92, 92, { orient: 'h' }),
        at(FOOT({ action: 'param', p: 'mute', label: 'MUTE', style: 'stomp', r: 12 }), 64, 184), at(LED({ bind: 'param:mute', color: '#ff3020', r: 2.8 }), 64, 162),
      ],
      initParams: { mute: 0 },
      derive: (p) => (p.mute ? { pad: 2, level: -24 } : { pad: 0, level: p.vol ?? 6 }),
      desc: 'Active DI with volume, phase and ground lift; footswitch mutes the XLR output (THRU stays live for tuning).',
    }),
  ]);
}
