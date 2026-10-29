// "Rig X Express", inspired by the Line 6 POD Express (guitar).
// AMP knob with a ring of model LEDs, DIST / MOD / DELAY / REVERB knobs (each sweeps four types, fully left = off),
// VOLUME, ALT (knobs become GAIN / MID / BASS / TREBLE / CH VOL), two footswitches and the built-in looper:
// press both switches to enter or leave looper mode.
export function registerExpress(tz) {
  const { K, BTN, FOOT, LED, def, db } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;
  const podAmps = ['deluxe', 'jcm800', 'dc30', 'dumble', 'friedman', 'recto', '5150'];
  const podCabs = ['1x12us', '4x12t75', '2x12blue', '2x12cream', '4x12gb', '4x12v30', '4x12uber'];
  const AMPN = ['OFF', 'CLEAN', 'SPECIAL', 'CHIME', 'DYNAMIC', 'CRUNCH', 'HEAVY', 'LEAD'];
  const LP_INDEX = 10; // position of the looper in the chain below
  const chain = [
    { prefix: 'gt', algo: 'gate', params: { threshold: 0.25 } },
    { prefix: 'ds', algo: 'drive', opts: { modes: [{ clip: 'ge', cleanSum: true, gainMaxDb: 24, tone: 'tilt' }, { clip: 'ts', cleanSum: true, clipHp: 720, gainMaxDb: 40, tone: 'ts', toneLo: 723 }, { clip: 'diode', gainMaxDb: 46, tone: 'blend' }, { clip: 'si', gainMaxDb: 50, tone: 'lp' }] } },
    { prefix: 'amp', algo: 'amp', opts: { models: podAmps } },
    { prefix: 'cab', algo: 'cab', opts: { models: podCabs } },
    { prefix: 'm1', algo: 'chorus', on: false }, { prefix: 'm2', algo: 'flanger', on: false }, { prefix: 'm3', algo: 'phaser', on: false }, { prefix: 'm4', algo: 'tremolo', on: false },
    { prefix: 'dl', algo: 'delay', opts: { maxMs: 2000 } },
    { prefix: 'rv', algo: 'reverb' },
    { prefix: 'lp', algo: 'looper', on: false, opts: { tracks: 1, maxSec: 60 } },
    { prefix: 'out', algo: 'utility', opts: { kind: 'gain' } },
  ];
  const ui = (id) => (tz.app.state.ui[id] = tz.app.state.ui[id] || {});
  const loopTrack = (st) => st && st.lp && st.lp.looper && st.lp.looper.tracks && st.lp.looper.tracks[0];
  const ev = (id, type) => tz.engine.send({ cmd: 'event', id, type, value: 0, arg: LP_INDEX * 100 });

  // real looper LED colours: red = recording, amber = overdub, green = playing, white = stopped with a loop
  const LOOPC = [null, '#ff2a1a', '#3ddc84', '#ffb020', '#ffffff'];
  const leftLed = (u, b, st, now) => {
    if (ui(b.id).podLoop) { const t = loopTrack(st); if (!t) return null; if (t.state === 1 && now % 400 < 200) return null; return LOOPC[t.state]; }
    return b.bypass ? null : '#ff2a1a';
  };
  const rightLed = (u, b, st, now) => {
    if (ui(b.id).podLoop) { const t = loopTrack(st); return t && (t.state === 2 || t.state === 3) ? '#3ddc84' : t && t.state === 4 ? '#ffffff' : null; }
    const ms = (tz.app.ui(b)['dl.time'] ?? 400);
    return now % ms < 70 ? '#3ddc84' : null;
  };

  tz.addForm('l6-podx', (ctx, d) => {
    const g = ctx.g, w = 236, h = 214;
    formKit.body(g, w, h, d.color, { rx: 18 });
    svg('rect', { x: 9, y: 9, width: w - 18, height: 124, rx: 12, fill: '#121315' }, g);
    const theme = { text: '#eeeeee', knob: 'chrome', labelSize: 5.6 };
    // amp model LEDs around the AMP knob
    const leds = [];
    AMPN.forEach((n, i) => {
      if (!i) return;
      const a = ((-135 + (270 * (i - 1)) / 6) * Math.PI) / 180;
      const x = 52 + Math.sin(a) * 30, y = 64 - Math.cos(a) * 30;
      leds.push(svg('circle', { cx: x, cy: y, r: 1.8, fill: '#3a1010' }, g));
      label(g, 52 + Math.sin(a) * 40, 64 - Math.cos(a) * 40, n, { size: 3.6, fill: '#bdbdbd', weight: 700 });
    });
    if (ctx.block) {
      ampLeds.set(ctx.block.id, leds);
      const a = tz.app.ui(ctx.block).ampsel ?? 5;
      leds.forEach((c, i) => c.setAttribute('fill', i === a - 1 ? '#ff2a1a' : '#3a1010'));
    }
    label(g, w / 2, 124, d.logo, { size: 8.5, fill: '#fff', weight: 800, ls: 2 });
    label(g, 62, 158, 'ON / REC', { size: 5, fill: '#f2d6d6', weight: 700 });
    label(g, 174, 158, 'TAP / PLAY', { size: 5, fill: '#f2d6d6', weight: 700 });
    label(g, w / 2, 176, 'BOTH = LOOPER', { size: 4.4, fill: '#f2d6d6', weight: 700 });
    formKit.tzBadge(g, w / 2, h - 8, '#fff', 4);
    formKit.placeControls(ctx, d.controls, theme);
    const all = [...d.ctrl.ins.map((c, i) => ({ key: 'ic' + i, dir: 'in', port: 'c' + i, label: c.label, kind: 'ctrl' })), ...d.ports.outs.map((l, i) => ({ key: 'o' + i, dir: 'out', port: i, label: l })), ...d.ports.ins.map((l, i) => ({ key: 'i' + i, dir: 'in', port: i, label: l }))];
    const jacks = all.map((j, k) => Object.assign(j, { side: 'top', y: -2, x: ctx.flip ? w - (30 + k * 44) : 30 + k * 44 }));
    return { w, h, theme, jacks };
  });
  const ampLeds = new Map();

  const d = def({
    id: 'l6.podexpress', name: 'Rig X Express', ref: 'Line 6 POD Express', brand: 'Line 6', code: 'RIG X', logo: 'RIG X  EXPRESS', cat: 'Multi-FX', form: 'l6-podx', color: '#c3161c',
    algo: 'chain', ports: { ins: ['INPUT'], outs: ['OUT L/MONO', 'OUT R', 'PHONES'] }, jackKinds: { o2: 'phones' }, cost: 6, alwaysOn: false,
    ctrl: { ins: [{ label: 'EXP/FS', param: 'vol', min: -30, max: 6 }] },
    opts: { chain },
    controls: [
      { t: 'sel', p: 'ampsel', label: 'AMP', options: AMPN, x: 52, y: 64, r: 18, def: 5, sweep: 270, style: 'chrome', printLabels: false, ring: false, labelPos: 'none', alt: 'amp.level', altLabel: 'CH VOL' },
      K('dist', 'DIST', { x: 112, y: 42, r: 11, def: 0, virtual: true, alt: 'amp.gain', altLabel: 'GAIN' }),
      K('mod', 'MOD', { x: 150, y: 42, r: 11, def: 0, virtual: true, alt: 'amp.mid', altLabel: 'MID' }),
      K('dly', 'DELAY', { x: 112, y: 90, r: 11, def: 0, virtual: true, alt: 'amp.bass', altLabel: 'BASS' }),
      K('rev', 'REVERB', { x: 150, y: 90, r: 11, def: 0.3, virtual: true, alt: 'amp.treble', altLabel: 'TREBLE' }),
      K('vol', 'VOLUME', { x: 196, y: 42, r: 10, min: -30, max: 6, def: 0, virtual: true, display: db }),
      BTN('ALT', { x: 196, y: 92, shape: 'rect', w: 18, h: 8, action: 'alt', led: true, ledDy: -8, ledColor: '#ffffff' }),
      FOOT({ action: 'bypass', x: 62, y: 190, r: 12 }),
      FOOT({ action: 'tap', x: 174, y: 190, r: 12, tapTarget: 'dl.time' }),
      LED({ x: 62, y: 146, bind: 'fn', ledFn: leftLed }), LED({ x: 174, y: 146, bind: 'fn', ledFn: rightLed, color: '#3ddc84' }),
    ],
    initParams: { 'amp.gain': 0.5, 'amp.treble': 0.5, 'amp.mid': 0.5, 'amp.bass': 0.5, 'amp.level': -3, 'dl.time': 400 },
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
      o['lp.on'] = (p._loop ?? 0) > 0.5 ? 1 : 0;
      o['out.level'] = p.vol ?? 0;
      return o;
    },
    desc: 'Four effect knobs each sweep four types (fully left = off), AMP picks one of seven amps and ALT turns the knobs into amp tone controls. Press both footswitches for the looper: left records / overdubs / plays (hold = undo), right plays / stops (hold = clear).',
  });
  tz.addDefs([d]);

  // footswitches: both together toggle looper mode; in looper mode they run the looper
  const down = new Map();
  const timers = new Map();
  tz.blockHooks('l6.podexpress', {
    foot(view, ctl, isDown) {
      const id = view.block.id, s = ui(id);
      const side = ctl.action === 'bypass' ? 'L' : 'R';
      const key = id + side, other = id + (side === 'L' ? 'R' : 'L');
      if (isDown) {
        down.set(key, performance.now());
        if (down.has(other)) {
          s.podLoop = !s.podLoop;
          s.swallow = 2;
          clearTimeout(timers.get(other));
          if (s.podLoop && (tz.app.ui(view.block)._loop ?? 0) < 0.5) tz.app.setParam(id, '_loop', 1);
          tz.ui.toast(s.podLoop ? 'Looper mode' : 'Looper off', 'info', 1000);
          return true;
        }
        if (!s.podLoop) return false;
        timers.set(key, setTimeout(() => { timers.delete(key); s.held = side; ev(id, side === 'L' ? 4 : 3); }, 900));
        return true;
      }
      down.delete(key);
      if (s.swallow) { s.swallow--; return true; }
      if (!s.podLoop) return false;
      if (s.held === side) { s.held = null; return true; }
      clearTimeout(timers.get(key));
      timers.delete(key);
      if (side === 'L') ev(id, 1);
      else { const t = loopTrack(tz.app.state.status.blocks[id]); ev(id, t && (t.state === 2 || t.state === 3) ? 2 : 1); }
      return true;
    },
  });
  // amp model ring follows the AMP knob
  tz.bus.on('param', () => {
    for (const b of tz.app.blocks()) {
      if (b.type !== 'l6.podexpress') continue;
      const l = ampLeds.get(b.id);
      if (!l) continue;
      const a = tz.app.ui(b).ampsel ?? 5;
      l.forEach((c, i) => c.setAttribute('fill', i === a - 1 ? '#ff2a1a' : '#3a1010'));
    }
  });
}
