// Built-in Tone Zone plugin: Tech 21.
// Blocks inspired by Tech 21 gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, preampOf, marshallKnobs, fenderKnobs } = tz.builders;
  // ---- long, slim all-in-one enclosure (four footswitches, sections printed on the top)
  tz.addForm('tech21-flyrig', (ctx, d) => {
    const { svg, label, formKit } = tz.gfx;
    const g = ctx.g, w = 380, h = 150, txt = d.text || '#e8e8e8';
    formKit.body(g, w, h, d.color, { rx: 8, brushed: true });
    const secs = [['p', 10, 100, 'PLXS'], ['s', 100, 230, 'SANSAMP'], ['d', 230, 370, 'DLY']];
    const kn = d.controls.filter((c) => c.t === 'knob');
    for (const [pre, x0, x1, name] of secs) {
      svg('rect', { x: x0 + 3, y: 8, width: x1 - x0 - 6, height: 78, rx: 5, fill: '#000', opacity: 0.25 }, g);
      label(g, (x0 + x1) / 2, 16, name, { size: 6.5, fill: txt, weight: 800, ls: 1.6, opacity: 0.85 });
      const ks = kn.filter((c) => c.p.startsWith(pre + '.') || (pre === 's' && c.p.startsWith('r.')));
      const n = Math.min(ks.length, 3), rows = Math.ceil(ks.length / 3);
      ks.forEach((c, i) => {
        const row = Math.floor(i / 3), inRow = Math.min(3, ks.length - row * 3), col = i % 3;
        const step = (x1 - x0 - 30) / Math.max(1, n - 1 || 1);
        const xs = inRow === 1 ? (x0 + x1) / 2 : x0 + 15 + col * step + ((n - inRow) * step) / 2;
        Object.assign(c, { x: xs, y: rows === 1 ? 48 : 34 + row * 29, r: rows === 1 ? 11 : 9, labelPos: 'below', labelSize: 4.8 });
      });
    }
    const foots = d.controls.filter((c) => c.t === 'foot'), leds = d.controls.filter((c) => c.t === 'led');
    const fx = [55, 165, 270, 335];
    foots.forEach((f, i) => Object.assign(f, { style: 'soft', x: fx[i], y: 120, r: 10, labelDy: 18 }));
    leds.forEach((l, i) => Object.assign(l, { x: fx[i], y: 98, r: 2.8 }));
    label(g, 110, 122, d.logo || d.name, { size: 11, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.4 });
    formKit.tzBadge(g, 218, 122, txt, 4);
    const theme = { text: txt, knob: d.knob || 'chrome', labelSize: 4.8 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 40, gap: 26, flip: ctx.flip }) };
  });
  tz.addDefs([
    def({ id: 'pre.sansamp', name: 'BassDrive DI', ref: 'Tech 21 SansAmp Bass Driver DI', cat: 'Preamp', form: 'tz', color: '#202020', text: '#e9e9e9', logo: 'BASS DRIVE', typeName: 'Bass preamp', knob: 'chrome',
        algo: 'drive', opts: { clip: 'tube', bias: 0.2, preHp: 30, gainMinDb: 0, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 12, bassF: 80, midF: 2800, trebleF: 4500, midQ: 0.9, postLp: 9000, levelMaxDb: 8 },
        controls: [K('level', 'LEVEL'), K('blend', 'BLEND', { def: 0.7 }), K('treble', 'TREBLE'), K('bass', 'BASS'), K('mid', 'PRESENCE'), K('gain', 'DRIVE', { def: 0.35 }), FOOT(), LED()] }),
    def({ id: 'pre.gtamp', name: 'Amp in a Box', ref: 'Tech 21 SansAmp GT2', cat: 'Preamp', form: 'tz', color: '#1f1f1f', text: '#e9e9e9', logo: 'AMP-IN-BOX', typeName: 'Guitar preamp', knob: 'chrome',
        algo: 'drive', opts: { clip: 'tube', stages: 2, bias: 0.25, gainMinDb: 4, gainMaxDb: 44, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3500, postLp: 6000, levelMaxDb: 6,
          modes: [{ postEq: [{ type: 'peak', f: 1200, q: 0.8, db: 3 }] }, { postEq: [{ type: 'peak', f: 700, q: 0.8, db: 2 }, { type: 'lp', f: 4800, q: 0.7, db: 0 }] }, { postEq: [{ type: 'peak', f: 500, q: 0.9, db: -3 }] }] },
        controls: [K('level', 'LEVEL'), K('treble', 'HIGH'), K('bass', 'LOW'), K('gain', 'DRIVE'), { t: 'sel', p: 'mode', label: 'AMP', options: ['CALI', 'TWEED', 'BRIT'], sweep: 100, def: 2 }, FOOT(), LED({ color: '#3ddc84' })] }),

    // ---------------- v0.2
    // Character Series: SansAmp-style amp-in-a-box with speaker-emulated output
    ...[
      { id: 'tech21.blonde', name: 'Character Blondie', ref: 'Tech 21 SansAmp Character Blonde', logo: 'BLONDIE', color: '#e6d9b4', text: '#2a2010', voice: { base: 'bassman', stages: [[36, 1.6, 0.22, 11000, 25], [30, 1.5, 0.28, 8500, 40]], otLp: 5200, otHp: 80 }, desc: 'Tweed / blackface American tones: from glassy clean to a cranked Bassman.' },
      { id: 'tech21.british', name: 'Character Brit', ref: 'Tech 21 SansAmp Character British', logo: 'BRIT', color: '#1c1c1c', text: '#d8b65e', voice: { base: 'jcm800', otLp: 5000, otHp: 90 }, desc: 'Plexi to hot-rodded 800-style British crunch and lead.' },
      { id: 'tech21.liverpool', name: 'Character Merseyside', ref: 'Tech 21 SansAmp Character Liverpool', logo: 'MERSEYSIDE', color: '#4b2f22', text: '#f0e2c6', voice: { base: 'ac30', otLp: 5600, otHp: 90 }, desc: 'Top Boost class-A chime with the Character knob sweeping from Normal to Top Boost.' },
    ].map((c) => def({ id: c.id, name: c.name, ref: c.ref, cat: 'Preamp', kind: 'Preamp', form: 'tz', color: c.color, text: c.text, logo: c.logo, typeName: 'Character Series', knob: 'chrome',
      algo: 'amp', cost: 1.6, opts: { preamp: true, voice: c.voice },
      controls: [K('level', 'LEVEL', { min: -24, max: 12, def: -2, display: db }), K('bass', 'LOW'), K('mid', 'MID'), K('treble', 'HIGH'), K('gain', 'DRIVE', { def: 0.5 }), K('presence', 'CHARACTER'), FOOT(), LED({ color: '#ff2a1a' })],
      derive: (u) => ({ bright: (u.presence ?? 0.5) > 0.6 ? 1 : 0 }), desc: c.desc })),
    def({ id: 'tech21.vtbass', name: 'VT Bassist', ref: 'Tech 21 SansAmp Character VT Bass', cat: 'Preamp', kind: 'Preamp', form: 'tz', color: '#2a2b2d', text: '#e8e8e8', logo: 'VT BASSIST', typeName: 'Bass preamp / DI', knob: 'chrome',
      algo: 'amp', cost: 1.6, opts: { preamp: true, voice: { base: 'svt', otLp: 5000, otHp: 30 } },
      controls: [K('level', 'LEVEL', { min: -24, max: 12, def: -2, display: db }), K('treble', 'HIGH'), K('mid', 'MID'), K('bass', 'LOW'), K('gain', 'DRIVE', { def: 0.45 }), K('midfreq', 'CHARACTER'), FOOT(), LED({ color: '#ff2a1a' })],
      desc: 'SVT-style tube bass tone in a pedal with a speaker-emulated DI output.' }),
    def({ id: 'tech21.flyrig', name: 'Air Rig 5', ref: 'Tech 21 Fly Rig 5', cat: 'Preamp', kind: 'Preamp', form: 'tech21-flyrig', color: '#202124', text: '#e8e8e8', logo: 'AIR RIG 5', typeName: 'Pedalboard in a box', knob: 'chrome',
      algo: 'chain', cost: 3.4, stereo: 'both', alwaysOn: true,
      opts: { chain: [
        { prefix: 'p', algo: 'drive', opts: { clip: 'asym', bias: 0.25, gainMinDb: 4, gainMaxDb: 40, tone: 'lp', toneLo: 1500, toneHi: 9000, postLp: 8000, levelMaxDb: 6 }, on: false },
        { prefix: 's', algo: 'amp', opts: { preamp: true, voice: { base: 'plexi', otLp: 5200, otHp: 80 } } },
        { prefix: 'd', algo: 'delay', opts: { maxMs: 1000 }, params: { mode: 1, time: 380, feedback: 0.3, mix: 0.25 }, on: false },
        { prefix: 'r', algo: 'reverb', params: { mode: 0, decay: 0.4, mix: 0.2 } },
      ] },
      controls: [
        K('p.level', 'LEVEL'), K('p.tone', 'TONE'), K('p.gain', 'DRIVE', { def: 0.55 }),
        K('s.level', 'LEVEL', { min: -24, max: 12, def: -2, display: db }), K('s.bass', 'LOW'), K('s.treble', 'HIGH'), K('s.gain', 'DRIVE', { def: 0.4 }),
        K('d.mix', 'LEVEL', { def: 0.25 }), K('d.feedback', 'REPEATS', { def: 0.3 }), K('d.time', 'TIME', { min: 40, max: 1000, def: 380, curve: 'log', display: ms }), K('d.moddepth', 'DRIFT', { def: 0.1 }),
        K('r.mix', 'REVERB', { def: 0.2 }),
        FOOT({ action: 'param', p: 'p.on', toggle: true, label: 'PLXS' }), FOOT({ action: 'param', p: 's.on', toggle: true, label: 'SANS' }), FOOT({ action: 'param', p: 'd.on', toggle: true, label: 'DLY' }), FOOT({ action: 'tap', label: 'TAP', tapSub: 2, tapTarget: 'd.time' }),
        LED({ bind: 'param:p.on' }), LED({ bind: 'param:s.on', color: '#3ddc84' }), LED({ bind: 'param:d.on', color: '#3d8bff' }), LED({ bind: 'tap:d.time', color: '#3d8bff' }),
      ],
      initParams: { 'p.on': 0, 's.on': 1, 'd.on': 0, 'r.on': 1 },
      derive: (u) => ({ 'r.on': (u['r.mix'] ?? 0) > 0.004 ? 1 : 0 }), desc: 'Slim all-in-one board: plexi-style drive, SansAmp preamp, analog-voiced delay with tap and a reverb.' }),
  ]);
}
