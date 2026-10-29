// Built-in Tone Zone plugin: Kemper.
// "Capture Player" - inspired by the Kemper Profiler Player: rigs made of an amp + cab profile with stomp A,
// stomp B, MOD, DELAY and REVERB slots. Eight knobs (FX1, FX2, GAIN, BASS, MID, TREBLE, RIG VOL, MASTER),
// BANK + rig buttons 1-5, a small display and three footswitches with LED rings.
import { createKit, CATS, modelsIn, pText } from './mfx-kit.js';

export default function register(tz) {
  const kit = createKit(tz);
  const { K, FOOT, SCREEN, def, db } = tz.helpers;
  const { svg, label, formKit, setA, setText } = tz.gfx;
  const ID = 'kpa.captureplayer';
  const N = 6;
  const FONT = "'Oswald', Impact, 'Arial Narrow', sans-serif";
  const AMB = '#ffb640';
  const SLOT = ['', 'STOMP A', 'STOMP B', 'RIG', 'MOD', 'DELAY', 'REVERB'];
  const CATS_OF = { 1: ['dist', 'dyn', 'wah', 'filter', 'pitch', 'eq'], 2: ['dist', 'dyn', 'wah', 'filter', 'pitch', 'eq'], 3: ['amp'], 4: ['mod'], 5: ['dly'], 6: ['rev'] };
  const RINGC = { dist: '#ff3b2f', dyn: '#3fa9ff', wah: '#ff9f1a', filter: '#ff4fd8', pitch: '#ffffff', eq: '#ffe14d', mod: '#3fa9ff', dly: '#4cff7a', rev: '#4cff7a' };
  const presets = [
    { name: 'Crunch Plexi', slots: { 1: ['scream', { gain: 0.25, level: 0.65 }], 2: ['redsq', {}, true], 3: ['ac-plexi'], 4: ['plasti', {}, true], 5: ['tape', { mix: 0.2 }], 6: ['plate', { mix: 0.2 }] } },
    { name: 'Black Face', slots: { 1: ['dlxcomp'], 2: ['minotaur', {}, true], 3: ['ac-usdlx'], 4: ['opttrem', {}, true], 5: ['adriatic', { mix: 0.22 }], 6: ['spring', { mix: 0.3 }] } },
    { name: 'Cali Lead', slots: { 1: ['scream', { gain: 0.15, level: 0.75 }], 2: ['gate', {}], 3: ['ac-mk2c'], 4: ['dimension', {}, true], 5: ['simple', { time: 450, mix: 0.25 }], 6: ['room', { mix: 0.18 }] } },
    { name: 'Brit Chime', slots: { 1: ['kinky', {}, true], 2: ['redsq'], 3: ['ac-ac30'], 4: ['univibe', {}, true], 5: ['tape', { mix: 0.2 }], 6: ['hall', { mix: 0.22 }] } },
    { name: 'Modern High Gain', slots: { 1: ['gate', { threshold: 0.45 }], 2: ['scream', { gain: 0.05, level: 0.8 }], 3: ['ac-recto', { 'a.gain': 0.4 }], 4: ['tzflg', {}, true], 5: ['simple', { mix: 0.15 }], 6: ['room', { mix: 0.12 }] } },
    { name: 'Dumble Smooth', slots: { 1: ['teemah', {}, true], 2: ['lastudio'], 3: ['ac-dumble'], 4: ['trinity', {}, true], 5: ['dual', { mix: 0.25 }], 6: ['plate', { mix: 0.25 }] } },
    { name: 'Orange Fuzz', slots: { 1: ['triangle'], 2: ['fassel', {}, true], 3: ['ac-orange', { 'a.gain': 0.4 }], 4: ['phase8', {}, true], 5: ['cosmos', { mix: 0.2 }], 6: ['spring', { mix: 0.25 }] } },
    { name: 'Jazz Clean', slots: { 1: ['lastudio'], 2: ['geq', {}, true], 3: ['ac-jc'], 4: ['plasti', {}, true], 5: ['simple', { mix: 0.15 }], 6: ['hall', { mix: 0.3 }] } },
    { name: 'Bass Rig', slots: { 1: ['redsq'], 2: ['suboct', {}, true], 3: ['ac-svt'], 4: ['plasti', {}, true], 5: ['simple', {}, true], 6: ['room', {}, true] } },
    { name: 'Ambient Glow', slots: { 1: ['volpedal'], 2: ['lastudio'], 3: ['ac-hiw', { 'a.gain': 0.35 }], 4: ['vibrato', {}, true], 5: ['shimdly', { mix: 0.3 }], 6: ['shimmer', { mix: 0.35 }] } },
  ];
  const B = (id) => kit.blk(id);
  const U = (id) => kit.ui(B(id));
  // FX1 / FX2 turn the first parameter of stomp A / B (its "intensity"), GAIN..RIG VOL go to the rig's amp
  const KMAP = [[1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [3, 6]];
  const KNAME = ['FX1', 'FX2', 'GAIN', 'BASS', 'MID', 'TREBLE', 'RIG VOL'];

  function rig(id, k) { kit.loadPreset(id, k); }
  function button(id, name, down) {
    const n = kit.nav(id);
    if (!down) return;
    const u = U(id);
    n.bank = n.bank ?? Math.floor((u._preset | 0) / 5);
    if (name === 'bank') { n.bank = (n.bank + 1) % 4; kit.say(id, 'BANK ' + (n.bank + 1)); }
    else rig(id, n.bank * 5 + name);
  }
  function footswitch(id, k, down) {
    const n = kit.nav(id);
    const holds = [() => kit.tuner(id), () => kit.loadPreset(id, ((U(id)._preset | 0) + 1) % 20), () => kit.tap(id)];
    kit.press(id + '|fs' + k, down, {
      ms: 800, hold: holds[k],
      tap: () => {
        if (n.view === 'tuner') return kit.tuner(id, false);
        kit.toggleSlot(id, [1, 2, 5][k]);
        n.focus = [1, 2, 5][k];
        kit.bump(id);
      },
    });
  }
  // the small display: tap the left / right third to change the focused slot's model, the middle to pick the slot
  function stepModel(id, d) {
    const n = kit.nav(id), u = U(id);
    const i = n.focus || 3;
    const list = CATS_OF[i].flatMap((c) => modelsIn(c));
    const m = kit.slotModel(u, i);
    const k = (list.findIndex((x) => m && x.idx === m.idx) + d + list.length) % list.length;
    kit.setModel(id, i, list[k].idx);
    if (i !== 3) kit.toggleSlot(id, i, 1);
  }
  const T = (g, x, y, s, o = {}) => kit.svgT(g, x, y, s, Object.assign({ font: FONT, weight: 600, fill: AMB }, o));
  tz.addScreen('kp-disp', {
    build(s, g, w, h) {
      s.w = w;
      svg('rect', { width: w, height: h, fill: '#0a0603' }, g);
      s.l1 = T(g, 4, 8, '', { size: 7 });
      s.r1 = T(g, w - 4, 8, '', { size: 5.2, anchor: 'end', fill: '#b07a2a' });
      s.l2 = T(g, 4, 21, '', { size: 6, fill: '#ffd28a' });
      s.fx = SLOT.slice(1).map((t, k) => T(g, 6 + k * ((w - 12) / 6) + (w - 12) / 12, h - 4, '', { size: 3.8, anchor: 'middle' }));
      s.arrL = T(g, 2, 21, '', { size: 6, fill: '#b07a2a' });
      s.sig = '';
    },
    update(s, st, nv, now) {
      const b = nv.block, id = b.id, u = s.ui, n = kit.nav(id), w = s.w;
      const lv = kit.live.get(id);
      if (lv) {
        [1, 2, 5].forEach((i, k) => { const m = kit.slotModel(u, i); const on = m && kit.slotOn(u, i); setA(lv.rings[k], 'stroke', m ? RINGC[m.cat] || AMB : '#333'); setA(lv.rings[k], 'stroke-opacity', on ? 1 : 0.15); });
        const bank = n.bank ?? Math.floor((u._preset | 0) / 5);
        lv.leds.forEach((l, k) => setA(l, 'fill', k === 0 ? (now % 1000 < 500 && n.bank !== undefined && n.bank !== Math.floor((u._preset | 0) / 5) ? AMB : '#3a2a10') : (u._preset | 0) === bank * 5 + k - 1 ? '#4cff7a' : '#10301a'));
      }
      if (n.view === 'tuner') {
        const t = st && st.tu && st.tu.tuner;
        setText(s.l1, t && t.note ? `TUNER  ${t.note}` : 'TUNER');
        setText(s.r1, t && t.note ? `${t.cents >= 0 ? '+' : ''}${t.cents.toFixed(1)}c` : '');
        setText(s.l2, t && t.note ? (Math.abs(t.cents) < 2 ? '>>  IN TUNE  <<' : t.cents < 0 ? '<<<  flat' : 'sharp  >>>') : 'play a string');
        s.sig = '';
        return;
      }
      const kOn = n.lastK && now - n.lastKT < 1500;
      const ton = n.msg && now - n.msgT < 1300;
      const sig = n.rev + '|' + (kOn ? n.lastK : 0) + (ton ? n.msg : '') + '|' + (n.focus || 3) + JSON.stringify(b.params);
      if (sig === s.sig) return;
      s.sig = sig;
      const bank = Math.floor((u._preset | 0) / 5) + 1, slot = ((u._preset | 0) % 5) + 1;
      setText(s.r1, `B${bank} · ${slot}`);
      if (kOn) {
        const [i, j] = KMAP[n.lastK - 1] || [];
        const m = i && kit.slotModel(u, i), p = m && m.P[j];
        setText(s.l1, KNAME[n.lastK - 1] || '');
        setText(s.l2, p ? `${p.n}: ${pText(p, kit.slotPos(u, i, j, m))}` : 'not used by this effect');
      } else {
        setText(s.l1, ton ? n.msg : kit.presetName(b).toUpperCase().slice(0, 18));
        const f = n.focus || 3, m = kit.slotModel(u, f);
        setText(s.l2, `◂ ${SLOT[f]}: ${m ? m.n : 'empty'} ▸`);
      }
      s.fx.forEach((e, k) => { const i = k + 1, m = kit.slotModel(u, i); setText(e, SLOT[i].replace('STOMP ', '')); setA(e, 'fill', i === (n.focus || 3) ? '#ffffff' : m && kit.slotOn(u, i) ? AMB : '#5a3d14'); });
      void w;
    },
    pointer(s, nv, type, pt) {
      if (type !== 'down') return;
      const id = nv.block.id, n = kit.nav(id);
      if (n.view === 'tuner') return kit.tuner(id, false);
      if (pt.y > 26) { const k = Math.floor((pt.x - 6) / ((s.w - 12) / 6)); if (k >= 0 && k < 6) n.focus = k + 1; }
      else if (pt.x < s.w / 3) stepModel(id, -1);
      else if (pt.x > (2 * s.w) / 3) stepModel(id, 1);
      else n.focus = ((n.focus || 3) % 6) + 1;
      kit.bump(id);
    },
  });

  // ---------------------------------------------------------------- enclosure
  const W = 240, H = 300;
  const KX = (k) => 36 + (k % 4) * 56, KY = (k) => (k < 4 ? 42 : 94);
  const BX = (k) => 30 + k * 36;
  const FX = (k) => 48 + k * 72;
  tz.addForm('kp-player', (ctx, d) => {
    const g = ctx.g;
    // wedge-ish box: dark green-grey with a black top plate
    formKit.body(g, W, H, '#2b2f2a', { rx: 12 });
    svg('rect', { x: 6, y: 6, width: W - 12, height: 192, rx: 9, fill: '#141614' }, g);
    const theme = { text: '#d6dbd2', knob: 'chrome', labelSize: 5.6, labelFont: FONT };
    label(g, W / 2, 206, 'CAPTURE PLAYER', { size: 8.4, fill: '#dfe6d8', weight: 600, ls: 1.4, font: FONT });
    formKit.tzBadge(g, W / 2, H - 8, '#7a8274', 3.8);
    const leds = [];
    ['BANK', '1', '2', '3', '4', '5'].forEach((t, k) => {
      svg('circle', { cx: BX(k), cy: 182, r: 8, fill: '#0a0b0a', stroke: '#3a3f38', 'stroke-width': 0.7 }, g);
      svg('circle', { cx: BX(k), cy: 182, r: 6.2, fill: '#2c302b' }, g);
      label(g, BX(k), 182, t, { size: t.length > 1 ? 3.8 : 5.4, fill: '#d6dbd2', weight: 600, font: FONT });
      leds.push(svg('circle', { cx: BX(k), cy: 169.5, r: 1.6, fill: '#10301a' }, g));
    });
    const rings = [];
    ['STOMP A', 'STOMP B', 'DELAY'].forEach((t, k) => {
      svg('circle', { cx: FX(k), cy: 250, r: 19, fill: '#0c0d0c', stroke: '#3a3f38', 'stroke-width': 0.8 }, g);
      rings.push(svg('circle', { cx: FX(k), cy: 250, r: 16.6, fill: 'none', stroke: '#333', 'stroke-width': 2.6, 'stroke-opacity': 0.15 }, g));
      label(g, FX(k), 224, t, { size: 5.6, fill: '#d6dbd2', weight: 600, font: FONT });
    });
    if (ctx.block) kit.live.set(ctx.block.id, { rings, leds });
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: kit.topJacks(d, W, ctx.flip, 26, W - 26) };
  });
  const LBL = ['FX1', 'FX2', 'GAIN', 'BASS', 'MID', 'TREBLE', 'RIG VOL'];
  const controls = [
    ...LBL.map((l, k) => K('k' + (k + 1), l, { x: KX(k), y: KY(k), r: 11, def: 0.5, virtual: true, labelPos: 'below' })),
    K('_vol', 'MASTER', { x: KX(7), y: KY(7), r: 11, min: -30, max: 6, def: 0, virtual: true, display: db, labelPos: 'below' }),
    SCREEN('kp-disp', { x: W / 2, y: 148, w: 150, h: 32, interactive: true, bg: '#0a0603', bezel: '#050505' }),
    ...['bank', 0, 1, 2, 3, 4].map((btn, k) => FOOT({ action: 'mfx', mfx: 'btn', btn, style: 'plate', w: 16, h: 16, x: BX(k), y: 182 })),
    ...[0, 1, 2].map((k) => FOOT({ action: 'mfx', mfx: 'fs', fs: k, style: 'stomp', r: 12, x: FX(k), y: 250 })),
  ];
  const d = def({
    id: ID, name: 'Capture Player', ref: 'Kemper Profiler Player', brand: 'Kemper', code: 'CAPTURE', typeName: 'Profiling amp player', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'kp-player', color: '#2b2f2a', cost: 5, alwaysOn: true,
    ports: { ins: ['INPUT'], outs: ['MONITOR L', 'MONITOR R', 'MAIN XLR', 'PHONES'] }, jackKinds: { o2: 'xlr', o3: 'phones' },
    ctrl: { ins: [{ label: 'PEDAL', hook: true, exp: 2 }] },
    controls,
    desc: 'Buttons 1-5 pick a rig (BANK steps banks), the footswitches turn stomp A, stomp B and the delay on and off (hold: tuner, next rig, tap). Tap the display sides to change the shown effect and the middle to pick another slot.',
  });
  kit.register(d, {
    n: N, knobs: 7, sel0: 3, layout: () => [1, 2, 3, 4, 5, 6], inputGate: false, looper: false, presets,
    knobTarget: (u, n, k) => KMAP[k - 1],
    foot(id, ctl, down) { if (ctl.mfx === 'btn') button(id, ctl.btn, down); else footswitch(id, ctl.fs, down); },
  });
  tz.addDefs([d]);
}
