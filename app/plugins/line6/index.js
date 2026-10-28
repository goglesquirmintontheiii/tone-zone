// Built-in Tone Zone plugin: Line 6.
// Blocks inspired by Line 6 gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  const podAmps = ['deluxe', 'jcm800', 'dc30', 'dumble', 'friedman', 'recto', '5150'];
  const podCabs = ['1x12us', '4x12t75', '2x12blue', '2x12cream', '4x12gb', '4x12v30', '4x12uber'];
  const podExpress = def({
    id: 'l6.podexpress', name: 'Rig X Express', ref: 'Line 6 POD Express', brand: 'Line 6', code: 'RIG X', logo: 'RIG X  EXPRESS', cat: 'Multi-FX', form: 'pod', color: '#c3161c',
    algo: 'chain', stereo: 'stereo', ports: { ins: ['IN'], outs: ['OUT L/MONO', 'OUT RIGHT'] }, cost: 6,
    opts: { chain: [
      { prefix: 'gt', algo: 'gate', params: { threshold: 0.25 } },
      { prefix: 'ds', algo: 'drive', opts: { modes: [{ clip: 'ge', cleanSum: true, gainMaxDb: 24, tone: 'tilt' }, { clip: 'ts', cleanSum: true, clipHp: 720, gainMaxDb: 40, tone: 'ts', toneLo: 723 }, { clip: 'diode', gainMaxDb: 46, tone: 'blend' }, { clip: 'si', gainMaxDb: 50, tone: 'lp' }] } },
      { prefix: 'amp', algo: 'amp', opts: { models: podAmps } },
      { prefix: 'cab', algo: 'cab', opts: { models: podCabs } },
      { prefix: 'm1', algo: 'chorus', on: false }, { prefix: 'm2', algo: 'flanger', on: false }, { prefix: 'm3', algo: 'phaser', on: false }, { prefix: 'm4', algo: 'tremolo', on: false },
      { prefix: 'dl', algo: 'delay', opts: { maxMs: 2000 } },
      { prefix: 'rv', algo: 'reverb' },
    ] },
    controls: [
      K('dist', 'DIST', { x: 46, y: 50, r: 15, def: 0, virtual: true, alt: 'amp.gain', altLabel: 'GAIN' }),
      K('rev', 'REVERB', { x: 138, y: 50, r: 15, def: 0.3, virtual: true, alt: 'amp.treble', altLabel: 'TREBLE' }),
      K('mod', 'MOD', { x: 46, y: 132, r: 15, def: 0, virtual: true, alt: 'amp.mid', altLabel: 'MID' }),
      K('dly', 'DELAY', { x: 138, y: 132, r: 15, def: 0, virtual: true, alt: 'amp.bass', altLabel: 'BASS' }),
      { t: 'sel', p: 'ampsel', label: 'AMP', options: ['OFF', 'CLEAN', 'SPECIAL', 'CHIME', 'DYNAMIC', 'CRUNCH', 'HEAVY', 'LEAD'], x: 92, y: 90, r: 19, def: 5, sweep: 300, style: 'chrome', printLabels: false, ring: true, labelPos: 'above', alt: 'amp.level', altLabel: 'CH VOL' },
      BTN('ALT', { x: 92, y: 132, shape: 'rect', w: 18, h: 8, action: 'alt', led: true, ledDy: -8, ledColor: '#ffffff' }),
      FOOT({ action: 'bypass', label: 'ON', x: 50, y: 222, r: 12 }),
      FOOT({ action: 'tap', label: 'TAP', x: 134, y: 222, r: 12, tapTarget: 'dl.time' }),
      LED({ x: 50, y: 196, bind: 'on' }), LED({ x: 134, y: 196, bind: 'tap:dl.time' }),
    ],
    initParams: { 'amp.gain': 0.5, 'amp.treble': 0.5, 'amp.mid': 0.5, 'amp.bass': 0.5, 'amp.level': 0, 'dl.time': 400 },
    derive: (p) => {
      const quad = (v) => {
        if (v < 0.03) return [-1, 0];
        const x = (v - 0.03) / 0.97 * 4;
        const q = Math.min(3, Math.floor(x));
        return [q, x - q];
      };
      const o = {};
      const [dq, dv] = quad(p.dist ?? 0);
      o['ds.on'] = dq >= 0 ? 1 : 0;
      o['ds.mode'] = Math.max(0, dq);
      o['ds.gain'] = 0.25 + 0.75 * dv;
      o['ds.level'] = 0.55;
      const a = p.ampsel ?? 5;
      o['amp.on'] = a > 0 ? 1 : 0;
      o['cab.on'] = a > 0 ? 1 : 0;
      o['amp.channel'] = Math.max(0, a - 1);
      o['cab.model'] = Math.max(0, a - 1);
      const [mq, mv] = quad(p.mod ?? 0);
      for (let i = 0; i < 4; i++) o[`m${i + 1}.on`] = mq === i ? 1 : 0;
      o['m1.mix'] = 0.3 + 0.5 * mv; o['m2.mix'] = 0.3 + 0.5 * mv; o['m3.mix'] = 0.3 + 0.5 * mv; o['m4.depth'] = 0.2 + 0.8 * mv;
      const [lq, lv] = quad(Math.min(p.dly ?? 0, 0.999));
      o['dl.on'] = lq >= 0 ? 1 : 0;
      o['dl.mode'] = [1, 0, 2, 7][Math.max(0, lq)];
      o['dl.mix'] = 0.15 + 0.5 * lv;
      o['dl.feedback'] = 0.25 + 0.35 * lv;
      const [rq, rv] = quad(p.rev ?? 0.3);
      o['rv.on'] = rq >= 0 ? 1 : 0;
      o['rv.mode'] = [3, 1, 2, 5][Math.max(0, rq)];
      o['rv.mix'] = 0.15 + 0.45 * rv;
      return o;
    },
    desc: 'Four effect knobs each sweep four models (fully counter-clockwise = off). AMP encoder: 7 amps + off. Press ALT to turn the knobs into GAIN / MID / BASS / TREBLE / CH VOL.',
  });
  tz.addDefs([
,
    podExpress
  ]);
}
