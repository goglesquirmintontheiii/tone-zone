// Built-in Tone Zone plugin: Ernie Ball.
// Blocks inspired by Ernie Ball treadle pedals. Names, logos and artwork are Tone Zone originals; control layouts
// and colours follow the real units (see each block's `ref`).

// Treadle enclosure with an optional side pod for knobs / switches (same layout as the Dunlop plugin's).
function treadleForm(tz) {
  const { svg, label, formKit, shade } = tz.gfx;
  return (ctx, def) => {
    const g = ctx.g;
    const w = def.tw || 152, h = def.th || 304;
    const pn = def.panel || null;
    const P = pn ? pn.w || 48 : 0;
    const col = def.color || '#1a1a1c';
    const py = pn ? pn.y ?? 40 : 0, ph = pn ? pn.h ?? h - 80 : 0;
    if (pn) {
      const pg = svg('g', { transform: `translate(${w - 18},${py})` }, g);
      formKit.body(pg, P + 18, ph, pn.color || shade(col, -0.1), { rx: 9 });
      if (pn.title) label(pg, 18 + P / 2, 12, pn.title, { size: 5.2, fill: def.text || '#d8d8d8', weight: 800, ls: 1 });
    }
    formKit.body(g, w, h, col, { rx: def.rx || 14, brushed: !!def.brushed });
    if (def.art) def.art(g, w, h, tz);
    svg('rect', { x: 6, y: h - 34, width: w - 12, height: 26, rx: 6, fill: '#0c0c0d', opacity: 0.6 }, g);
    const theme = { text: def.text || '#d8d8d8', knob: def.knob || 'mxr', labelSize: 5.8 };
    def.controls.forEach((c) => {
      if (c.t === 'treadle' && c.x === undefined)
        Object.assign(c, { x: w / 2, y: h / 2 - 12, w: w - 30, h: h - 66, color: def.treadleColor || '#161618', logo: def.logo, logoColor: def.logoColor, logoFont: def.logoFont, logoSize: def.logoSize });
      if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: h - 21, r: 2.6 });
    });
    const pc = def.controls.filter((c) => c.panel && c.x === undefined);
    const gap = pn && pn.gap ? pn.gap : pc.length > 1 ? Math.min(52, (ph - 46) / (pc.length - 0.4)) : 0;
    pc.forEach((c, i) => {
      c.x = w + P / 2;
      c.y = py + (pn.top ?? (pn.title ? 50 : 36)) + i * gap;
      if (c.t === 'knob' || c.t === 'sel') { c.r = c.r || 9.5; c.labelPos = c.labelPos || (c.t === 'sel' ? 'below' : 'above'); }
      if (c.t === 'toggle') c.orient = c.orient || 'h';
      if (c.t === 'foot') { c.style = c.style || 'stomp'; c.r = c.r || 10; }
      if (c.t === 'screen') { c.w = c.w || P - 8; c.h = c.h || 14; }
    });
    label(g, 24, h - 21, def.code, { size: 6, fill: theme.text, weight: 800, ls: 1, anchor: 'start' });
    formKit.tzBadge(g, w - 24, h - 21, theme.text, 4.2).setAttribute('text-anchor', 'end');
    formKit.placeControls(ctx, def.controls, theme);
    const W = w + P;
    return { w: W, h, theme, jacks: formKit.jacksSide(def, W, { y0: def.jackY ?? h - 96, gap: 24, flip: ctx.flip }) };
  };
}

export default function register(tz) {
  const { K, TOG, LED, TREADLE, def, ms, STEREO } = tz.helpers;
  const { svg } = tz.gfx;
  tz.addForm('eb-treadle', treadleForm(tz));
  // cast-aluminium look: black crackle body with a polished edge strip
  const art = (g, w, h) => {
    svg('rect', { x: 3, y: 3, width: w - 6, height: h - 6, rx: 12, fill: 'none', stroke: '#9aa0a8', 'stroke-width': 1.4, opacity: 0.55 }, g);
  };
  const EB = (o) => def(Object.assign({ brand: 'Ernie Ball', form: 'eb-treadle', color: '#151517', treadleColor: '#101012', logoFont: "'Oswald', sans-serif", logoColor: '#e9e9e9', text: '#e2e2e2', art }, o));
  tz.addDefs([
    EB({
      id: 'eb.vpjr', name: 'Volu-Max Jr', ref: 'Ernie Ball VP Jr 250K', code: 'VMX-JR', cat: 'Volume', tw: 124, th: 300, logo: 'VOLU-MAX', logoSize: 17,
      algo: 'volume', noBypassClick: true, stereo: 'both',
      controls: [TREADLE('pos', { def: 1 })], fixed: { min: 0, taper: 1 },
      desc: 'Compact passive-style volume pedal with an audio taper (heel = silent).',
    }),
    EB({
      id: 'eb.ambdelay', name: 'Ambient Sweep Delay', ref: 'Ernie Ball Ambient Delay (Expression series)', code: 'ASD-1', cat: 'Delay', logo: 'AMBIENT', logoSize: 18,
      algo: 'delay', opts: { maxMs: 1500 }, stereo: 'both', toeSwitch: true, cost: 0.9,
      panel: { w: 50, y: 36, h: 238, title: 'DELAY' },
      controls: [TREADLE('sweep', { def: 0.5, virtual: true }), LED({ color: '#3ddc84', r: 2.2 }),
        K('time', 'TIME', { panel: true, min: 40, max: 1500, def: 480, curve: 'log', display: ms }), K('feedback', 'REPEATS', { panel: true, def: 0.4 }), K('tone', 'TONE', { panel: true, def: 0.55 }),
        TOG('target', 'EXP', ['MIX', 'RPT'], { panel: true, def: 0 })],
      derive: (p) => {
        const s = p.sweep ?? 0.5;
        return p.target ? { mix: 0.4, feedback: 0.1 + 0.9 * s, mode: 1, moddepth: 0.15 } : { mix: 0.7 * s, mode: 1, moddepth: 0.15 };
      },
      desc: 'Analog-voiced delay where the treadle sweeps the delay level (or the repeats with EXP = RPT). Swell echoes in and out with your foot.',
    }),
    EB({
      id: 'eb.exptrem', name: 'Tremolo Sweep', ref: 'Ernie Ball Expression Tremolo', code: 'TRS-1', cat: 'Modulation', logo: 'TREMOLO', logoSize: 18,
      algo: 'tremolo', stereo: 'both', toeSwitch: true,
      panel: { w: 50, y: 36, h: 238, title: 'TREMOLO' },
      controls: [TREADLE('sweep', { def: 0.5, virtual: true }), LED({ color: '#ff2a1a', r: 2.2 }),
        K('depth', 'DEPTH', { panel: true, def: 0.6 }), K('smin', 'SPEED 1', { panel: true, def: 0.2, virtual: true }), K('smax', 'SPEED 2', { panel: true, def: 0.8, virtual: true }),
        TOG('wave', 'WAVE', ['SINE', 'SQR'], { panel: true, values: [0.25, 0.95] })],
      derive: (p) => { const a = p.smin ?? 0.2, b = p.smax ?? 0.8, s = p.sweep ?? 0.5; return { rate: a + (b - a) * s, mode: 0 }; },
      desc: 'The treadle morphs the tremolo speed between SPEED 1 (heel) and SPEED 2 (toe).',
    }),
    EB({
      id: 'eb.expod', name: 'Drive Sweep', ref: 'Ernie Ball Expression Overdrive', code: 'DRS-1', cat: 'Overdrive', logo: 'OVERDRIVE', logoSize: 17,
      algo: 'drive', toeSwitch: true,
      opts: { clip: 'asym', bias: 0.15, preHp: 90, gainMinDb: 0, gainMaxDb: 40, tone: 'lp', toneLo: 1400, toneHi: 9000, levelMaxDb: 4 },
      panel: { w: 50, y: 60, h: 214, title: 'DRIVE' },
      controls: [TREADLE('gain', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2.2 }),
        K('level', 'LEVEL', { panel: true, def: 0.45 }), K('tone', 'TONE', { panel: true, def: 0.55 })],
      desc: 'Overdrive whose gain follows the treadle: heel = clean boost, toe = full crunch.',
    }),
  ]);

  // ---- v0.4 additions
  tz.addDefs([
    EB({
      id: 'eb.vp6166', name: 'Volu-Max Big', ref: 'Ernie Ball Volume Pedal 6166 (250K)', code: 'VMX-250', cat: 'Volume', tw: 164, th: 318, logo: 'VOLU-MAX', logoSize: 19,
      algo: 'volume', noBypassClick: true, fixed: { min: 0, taper: 1 },
      controls: [TREADLE('pos', { def: 1 })],
      desc: 'Full-size volume pedal with a long, smooth sweep.',
    }),
    EB({
      id: 'eb.vpjr25', name: 'Volu-Max Jr Active', ref: 'Ernie Ball VP Jr 25K', code: 'VMX-25K', cat: 'Volume', tw: 124, th: 300, logo: 'VOLU-MAX', logoSize: 17, logoColor: '#7fc4ff',
      algo: 'volume', noBypassClick: true, stereo: 'both', fixed: { min: 0, taper: 0.7 },
      controls: [TREADLE('pos', { def: 1 })],
      desc: 'Compact volume pedal for active pickups or after effects (low impedance, smoother taper).',
    }),
    EB({
      id: 'eb.mvp', name: 'Most Valued Volume', ref: 'Ernie Ball MVP Most Valuable Pedal', code: 'MVV', cat: 'Volume', logo: 'M.V.V.', logoSize: 19,
      algo: 'chain', noBypassClick: true,
      opts: { chain: [{ prefix: 'g', algo: 'utility', opts: { kind: 'gain' } }, { prefix: 'v', algo: 'volume', params: { taper: 1 } }] },
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'TUNER OUT'] }, stereo: 'fixedDual',
      panel: { w: 46, y: 120, h: 150 },
      controls: [TREADLE('v.pos', { def: 1 }), K('g.level', 'GAIN', { panel: true, min: -12, max: 12, def: 0, r: 8.5 }), K('v.min', 'MIN', { panel: true, def: 0, r: 8.5 })],
      desc: 'Volume pedal with a GAIN knob (pad or up to +12 dB boost), a minimum-volume knob and a tuner output.',
    }),
    EB({
      id: 'eb.stereovp', name: 'Volu-Max Stereo Pan', ref: 'Ernie Ball Stereo Volume / Pan 6165', code: 'VMX-ST', cat: 'Volume', tw: 160, th: 312, logo: 'STEREO', logoSize: 18,
      algo: 'chain', noBypassClick: true, stereo: 'stereo', ports: STEREO,
      opts: { chain: [{ prefix: 'v', algo: 'volume', params: { taper: 1 } }, { prefix: 'p', algo: 'stereo', params: { mode: 6 } }] },
      controls: [TREADLE('pos', { def: 1, virtual: true }), TOG('pan', '', ['VOL', 'PAN'], { x: 80, y: 290, orient: 'h', virtual: true })],
      derive: (p) => { const x = p.pos ?? 1; return p.pan ? { 'v.pos': 1, 'p.on': 1, 'p.pan': 2 * x - 1 } : { 'v.pos': x, 'p.on': 0 }; },
      desc: 'Stereo volume pedal. In PAN mode the treadle moves the sound from left to right.',
    }),
  ]);
}
