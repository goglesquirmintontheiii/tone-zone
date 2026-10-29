// Built-in Tone Zone plugin: Tech 21.
// Blocks inspired by Tech 21 gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, preampOf, marshallKnobs, fenderKnobs } = tz.builders;
  registerFlyRig(tz);
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
  ]);
}

// Fly Rig 5 style strip: PLXS drive + boost, SansAmp with speaker sim, reverb, delay with tap. No screen.
function registerFlyRig(tz) {
  const { K, BTN, FOOT, LED, def, db, ms } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;
  // sections: [label, x0, x1, on-param]
  const SECS = [['PLXS', 8, 96, 'p.on'], ['BOOST', 96, 128, 'b.on'], ['SANSAMP', 128, 282, 's.on'], ['REVERB', 282, 318, 'r.on'], ['DLY', 318, 452, 'd.on']];
  tz.addForm('tech21-flyrig5', (ctx, d) => {
    const g = ctx.g, w = 460, h = 132, txt = '#e8e8e8';
    formKit.body(g, w, h, d.color, { rx: 8, brushed: true });
    for (const [name, x0, x1] of SECS) {
      svg('rect', { x: x0 + 2, y: 15, width: x1 - x0 - 4, height: 62, rx: 4, fill: '#000', 'fill-opacity': 0.28 }, g);
      label(g, (x0 + x1) / 2, 21.5, name, { size: 5.6, fill: txt, weight: 800, ls: 1.4 });
    }
    label(g, 283, 110, d.logo, { size: 12, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.6 });
    formKit.tzBadge(g, 283, 121, '#9a9ca0', 3.6);
    const theme = { text: txt, knob: 'chrome', labelSize: 4.4 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });
  const kx = (x0, x1, n, i) => x0 + ((x1 - x0) * (i + 0.5)) / n;
  const knob = (p, l, sec, n, i, o = {}) => Object.assign(K(p, l, o), { x: kx(SECS[sec][1], SECS[sec][2], n, i), y: 40, r: 9, labelPos: 'below' });
  const btn = (p, l, x) => Object.assign(BTN(l, { p, toggle: true, shape: 'rect', w: 18, h: 7, led: true, ledColor: '#ffb000', ledDx: 13, ledDy: 0, labelPos: 'below' }), { x, y: 66, labelSize: 3.8 });
  const fx = [52, 112, 205, 360, 425];
  const fsp = ['p.on', 'b.on', 's.on', 'd.on'];
  tz.addDefs([def({
    id: 'tech21.flyrig', name: 'Air Rig 5', ref: 'Tech 21 Fly Rig 5', cat: 'Multi-FX', kind: 'Multi-FX', form: 'tech21-flyrig5', color: '#202124', logo: 'AIR RIG 5', typeName: 'Analog multi-effect strip',
    algo: 'chain', cost: 4.2, alwaysOn: true, noBypassClick: true,
    ports: { ins: ['INPUT'], outs: ['OUTPUT', 'XLR OUT'] }, jackKinds: { o1: 'xlr' },
    opts: { chain: [
      { prefix: 'p', algo: 'drive', on: false, opts: { clip: 'asym', bias: 0.25, gainMinDb: 4, gainMaxDb: 40, tone: 'lp', toneLo: 1500, toneHi: 9000, postLp: 8000, levelMaxDb: 6,
        modes: [{}, { gainMaxDb: 48, preEq: [{ type: 'peak', f: 800, q: 0.8, db: 5 }] }] } },
      { prefix: 'b', algo: 'drive', on: false, opts: { clip: 'clean', gainMinDb: 0, gainMaxDb: 12, tone: 'none', levelMaxDb: 0 } },
      { prefix: 's', algo: 'amp', opts: { preamp: true, voice: { base: 'bassman', otLp: 5200, otHp: 80 } } },
      { prefix: 'c', algo: 'cab', opts: { model: '1x12open' }, params: { m1pos: 0.4 } },
      { prefix: 'd', algo: 'delay', on: false, opts: { maxMs: 1200 }, params: { mode: 1 } },
      { prefix: 'r', algo: 'reverb', params: { mode: 0 } },
    ] },
    controls: [
      knob('p.level', 'LEVEL', 0, 3, 0), knob('p.tone', 'TONE', 0, 3, 1), knob('p.gain', 'DRIVE', 0, 3, 2, { def: 0.55 }),
      knob('b.gain', 'LEVEL', 1, 1, 0, { def: 0.6 }),
      knob('s.level', 'LEVEL', 2, 5, 0, { min: -24, max: 12, def: 2, display: db }), knob('s.bass', 'LOW', 2, 5, 1), knob('s.mid', 'MID', 2, 5, 2), knob('s.treble', 'HIGH', 2, 5, 3), knob('s.gain', 'DRIVE', 2, 5, 4, { def: 0.4 }),
      knob('r.mix', 'MIX', 3, 1, 0, { def: 0.22 }),
      knob('d.mix', 'LEVEL', 4, 4, 0, { def: 0.28 }), knob('d.feedback', 'REPEATS', 4, 4, 1, { def: 0.32 }), knob('d.time', 'TIME', 4, 4, 2, { min: 40, max: 1200, def: 380, curve: 'log', display: ms }), knob('d.moddepth', 'DRIFT', 4, 4, 3, { def: 0.12 }),
      btn('p.mode', 'HOT', 52), btn('_hall', 'HALL', 300), btn('_dot', '8TH DOT', 385),
      ...fsp.map((p, i) => Object.assign(FOOT({ action: 'param', p, label: ['PLXS', 'BOOST', 'SANSAMP', 'DLY'][i] }), { style: 'soft', x: fx[i], y: 106, r: 10, labelDy: 17 })),
      Object.assign(FOOT({ action: 'tap', label: 'TAP', tapSub: 4, tapTarget: 'd.time' }), { style: 'soft', x: fx[4], y: 106, r: 10, labelDy: 17 }),
      ...fsp.map((p, i) => Object.assign(LED({ bind: 'param:' + p, color: ['#ff3020', '#ffb000', '#3ddc84', '#3d8bff'][i] }), { x: fx[i], y: 88, r: 2.6 })),
      Object.assign(LED({ bind: 'fn', color: '#3d8bff', ledFn: (ui, b, st, now) => ((now % (ui['d.time'] * (ui._dot ? 0.75 : 1) || 380)) < 60 ? '#3d8bff' : ui['r.on'] > 0.5 ? '#2a4c80' : null) }), { x: fx[4], y: 88, r: 2.6 }),
    ],
    initParams: { 'p.on': 0, 'b.on': 0, 's.on': 1, 'd.on': 0, 'r.on': 1, 'p.mode': 0, _hall: 0, _dot: 0 },
    derive: (u) => ({ 'c.on': u['s.on'] ?? 1, 'r.mode': u._hall ? 1 : 0, 'd.time': (u['d.time'] ?? 380) * (u._dot ? 0.75 : 1), 'b.level': 0.5 }),
    desc: 'Slim analog-style strip: plexi drive with HOT switch, +12 dB boost, SansAmp preamp with speaker sim, reverb and a delay with tap. Hold TAP to switch the reverb.',
  })]);
  // hold TAP to switch the reverb on / off
  const holds = new Map();
  tz.blockHooks('tech21.flyrig', {
    foot(view, ctl, down) {
      if (ctl.action !== 'tap') return false;
      const id = view.block.id;
      if (down) {
        const h = { held: false };
        h.t = setTimeout(() => { h.held = true; const u = tz.app.ui(view.block); tz.app.setParam(id, 'r.on', (u['r.on'] ?? 1) > 0.5 ? 0 : 1); }, 800);
        holds.set(id, h);
        return false;
      }
      const h = holds.get(id);
      holds.delete(id);
      if (h) clearTimeout(h.t);
      return !!(h && h.held);
    },
  });
}
