// mooer.gn300: flagship floor multi-effects inspired by the Mooer GE300: colour screen with a 14-module chain,
// SELECT encoder (turn / push) with ◀ ▶, five parameter knobs, MASTER, system buttons (DISPLAY, GLB-EQ, CTL,
// SYSTEM, SAVE, EXP), module buttons, ten footswitches (A-D presets, ▲▼ bank, CTRL 1-4 assignable), a looper,
// a 3-voice-style synth module, tone-capture style EQ profiles and an expression pedal.
import { makeKit, stdParts, stdLanes } from './mfx-kit.js';

export function registerGE300(tz) {
  const { K, FOOT, LED, SCREEN, TREADLE, def } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;
  const kit = makeKit(tz);
  const { P, A, T, R, st, sa, fmt, nav } = kit;
  const S = stdParts(P);

  const CATS = [
    { key: 'SYN', name: 'SYNTH', color: '#ff4fd8' },
    { key: 'CMP', name: 'COMP', color: '#ffd23f' },
    { key: 'WAH', name: 'WAH', color: '#ffa53f' },
    { key: 'FXA', name: 'FX A', color: '#3fb6ff' },
    { key: 'DS', name: 'DS/OD', color: '#ff4b3f' },
    { key: 'AMP', name: 'AMP', color: '#ff3f6e' },
    { key: 'CAB', name: 'CAB', color: '#d7975a' },
    { key: 'NS', name: 'NS', color: '#a5b1bd' },
    { key: 'TC', name: 'TONE CAP', color: '#b7ff3f' },
    { key: 'EQ', name: 'EQ', color: '#3fffd5' },
    { key: 'FXB', name: 'FX B', color: '#5a7cff' },
    { key: 'DLY', name: 'DELAY', color: '#5cff6e' },
    { key: 'RVB', name: 'REVERB', color: '#b36bff' },
    { key: 'VOL', name: 'VOL', color: '#e2e6ea' },
  ];
  const v = {
    ts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 6, gainMaxDb: 40, tone: 'ts', toneLo: 723, postLp: 6500 },
    klon: { clip: 'si', cleanSum: true, cleanMix: 0.45, gainMinDb: 2, gainMaxDb: 34, tone: 'tilt', postLp: 9000 },
    rat: { clip: 'si', gainMinDb: 12, gainMaxDb: 52, tone: 'rat', postLp: 7000 },
    muff: { clip: 'muff', stages: 2, stage2Db: 12, gainMinDb: 16, gainMaxDb: 50, tone: 'blend', postLp: 6000 },
    od: { clip: 'asym', gainMinDb: 6, gainMaxDb: 38, tone: 'lp', toneLo: 1200, toneHi: 7000, postLp: 7000 },
    metal: { clip: 'si', stages: 2, stage2Db: 18, gainMinDb: 20, gainMaxDb: 60, preHp: 140, tone: 'eq3', postLp: 7500 },
    boost: { clip: 'clean', gainMinDb: 0, gainMaxDb: 20, tone: 'tilt' },
  };
  // FX A / FX B share one list (each list entry exists for both modules)
  const fx = [
    ['Chorus', S.chorus(0)], ['Tri Chorus', S.chorus(2, { mix: 0.45 })], ['Vibrato', S.chorus(1, { mix: 1 })], ['Flanger', S.flanger(0)],
    ['Phaser', S.phaser(4)], ['Step Phaser', S.phaser(8)], ['Tremolo', S.trem(0)], ['Harm Trem', S.trem(1)], ['Vibe', S.vibe()], ['Rotary', S.rotary()],
    ['Octave', S.pitch(1 / 7, { mix: 0.6 })], ['Pitch Shift', S.pitch(6 / 7, { mix: 0.4 })], ['Ring Mod', S.ring()], ['Bit Crusher', S.crusher()],
  ];
  // tone capture style EQ profiles (approximation: matched EQ curves / acoustic body)
  const tc = (name, eq) => ({ name, cat: 'TC', pool: 'tc', params: [P('AMOUNT', null, 0.7), P('LEVEL', 'level', 0.5, { min: -12, max: 12, fmt: 'db' })],
    fx: (o, vals, pre) => { const a = vals[0]; o[pre + '.lowgain'] = eq[0] * a; o[pre + '.lowfreq'] = eq[1]; o[pre + '.mid1gain'] = eq[2] * a; o[pre + '.mid1freq'] = eq[3]; o[pre + '.mid1q'] = 0.8; o[pre + '.highgain'] = eq[4] * a; o[pre + '.highfreq'] = eq[5]; } });
  const CABL = ['1x12us', '2x12twin', '4x10tweed', '2x12blue', '4x12gb', '4x12v30', '4x12t75', '4x12uber', '1x12open', '4x12orange'];
  const LIB = [
    ...['SQUARE LEAD', 'SAW LEAD', 'ORGAN', 'STRINGS', 'BRASS', 'SUB BASS', 'PAD', 'FILTER SWEEP'].map((n, i) => ({ name: n, cat: 'SYN', ...S.synth(i) })),
    { name: 'Studio Comp', cat: 'CMP', ...S.comp('cmp') },
    { name: 'Squash Comp', cat: 'CMP', ...S.comp('cmpO') },
    { name: 'Vintage Wah', cat: 'WAH', pedal: 'wah', ...S.wah(0) },
    { name: 'Auto Wah', cat: 'WAH', ...S.wah(2) },
    { name: 'Q Wah', cat: 'WAH', ...S.wah(1, 0) },
    ...fx.map(([n, m]) => ({ name: n, cat: 'FXA', ...m })),
    { name: 'Green Drive', cat: 'DS', ...S.drv(v.ts), params: [P('GAIN', 'gain', 0.45), P('TONE', 'tone', 0.5), P('LEVEL', 'level', 0.55)] },
    { name: 'Gold Klone', cat: 'DS', ...S.drv(v.klon), params: [P('GAIN', 'gain', 0.3), P('TREBLE', 'tone', 0.55), P('LEVEL', 'level', 0.55)] },
    { name: 'Hot OD', cat: 'DS', ...S.drv(v.od) },
    { name: 'Mouse Dist', cat: 'DS', ...S.drv(v.rat), params: [P('DIST', 'gain', 0.5), P('FILTER', 'tone', 0.45), P('LEVEL', 'level', 0.45)] },
    { name: 'Muffy Fuzz', cat: 'DS', ...S.drv(v.muff), params: [P('SUSTAIN', 'gain', 0.55), P('TONE', 'tone', 0.5), P('LEVEL', 'level', 0.45)] },
    { name: 'Metal Wall', cat: 'DS', ...S.drv(v.metal), params: [P('GAIN', 'gain', 0.6), P('LOW', 'bass', 0.6), P('MID', 'mid', 0.4), P('HIGH', 'treble', 0.6), P('LEVEL', 'level', 0.4)] },
    { name: 'Clean Boost', cat: 'DS', ...S.drv(v.boost), params: [P('BOOST', 'gain', 0.4), P('TONE', 'tone', 0.5), P('LEVEL', 'level', 0.5)] },
    { name: 'Deluxe Rev', cat: 'AMP', ...S.amp('deluxe', { gain: 0.45 }) },
    { name: 'Twin Clean', cat: 'AMP', ...S.amp('twin', { gain: 0.3 }) },
    { name: 'Bass Tweed', cat: 'AMP', ...S.amp('bassman', { gain: 0.5 }) },
    { name: 'AC Boost', cat: 'AMP', ...S.amp('ac30', { gain: 0.45 }) },
    { name: 'Plexi 59', cat: 'AMP', ...S.amp('plexi', { gain: 0.55 }) },
    { name: 'UK 800', cat: 'AMP', ...S.amp('jcm800', { gain: 0.55 }) },
    { name: 'Brown Sound', cat: 'AMP', ...S.amp('5150', { gain: 0.55 }) },
    { name: 'Cali Rect', cat: 'AMP', ...S.amp('recto', { gain: 0.6 }) },
    { name: 'Cali Mk II', cat: 'AMP', ...S.amp('markiic', { gain: 0.55 }) },
    { name: 'Diezel VH', cat: 'AMP', ...S.amp('vh4', { gain: 0.55 }) },
    { name: 'Uber Lead', cat: 'AMP', ...S.amp('uber', { gain: 0.55 }) },
    { name: 'Smooth D', cat: 'AMP', ...S.amp('dumble', { gain: 0.45 }) },
    ...CABL.map((c) => ({ name: c.replace(/^(\dx\d+)(.*)$/, (m, a, b) => `${a.toUpperCase()} ${b.toUpperCase()}`), cat: 'CAB', ...S.cab(c) })),
    { name: 'Noise Gate', cat: 'NS', ...S.gate() },
    tc('SC > HB', [4, 160, 3.5, 700, -3, 4500]),
    tc('HB > SC', [-3, 160, -3, 650, 4, 3800]),
    tc('Les > Tele', [-2, 140, -2.5, 500, 5, 4200]),
    { name: 'Acoustic Sim', cat: 'TC', pool: 'aco', fixed: { mode: 0, mix: 1 }, params: [P('BODY', 'body', 0.6), P('TOP', 'top', 0.5), P('TYPE', 'type', 0, { opts: ['DREAD', 'JUMBO', 'PARLOR', 'NYLON', '12-STR'] }), P('REVERB', 'reverb', 0.2), P('LEVEL', 'level', 0.5, { min: -24, max: 12, fmt: 'db' })] },
    { name: 'Graphic EQ', cat: 'EQ', ...S.eq() },
    { name: 'Para EQ', cat: 'EQ', ...S.peq() },
    ...fx.map(([n, m]) => ({ name: n, cat: 'FXB', ...m, fixed: Object.assign({}, m.fixed) })),
    { name: 'Digital', cat: 'DLY', ...S.dly(0) },
    { name: 'Analog', cat: 'DLY', ...S.dly(1, [P('TONE', 'tone', 0.4)]) },
    { name: 'Tape', cat: 'DLY', ...S.dly(2, [P('WOW', 'moddepth', 0.25), P('AGE', 'age', 0.35)]) },
    { name: 'Mod Delay', cat: 'DLY', ...S.dly(4, [P('RATE', 'modrate', 0.3), P('DEPTH', 'moddepth', 0.4)]) },
    { name: 'Reverse', cat: 'DLY', ...S.dly(5) },
    { name: 'Ping Pong', cat: 'DLY', ...S.dly(7, [P('SPREAD', 'spread', 0.8)]) },
    { name: 'Half Time', cat: 'DLY', ...S.dly(8, [P('SPREAD', 'spread', 0.6)]) },
    { name: 'Room', cat: 'RVB', ...S.rev(0) },
    { name: 'Hall', cat: 'RVB', ...S.rev(1) },
    { name: 'Plate', cat: 'RVB', ...S.rev(2) },
    { name: 'Spring', cat: 'RVB', ...S.rev(3) },
    { name: 'Shimmer', cat: 'RVB', ...S.rev(4, [P('SHIMMER', 'shimmer', 0.5)]) },
    { name: 'Cloud', cat: 'RVB', ...S.rev(5) },
    { name: 'Swell Verb', cat: 'RVB', ...S.rev(9) },
    { name: 'Volume', cat: 'VOL', pedal: 'vol', ...S.vol() },
  ];
  // lanes: standard order + tone-capture EQ after the cab, acoustic before the drives, global EQ before the output
  const lanes = stdLanes({ drv: 1, dly: 1, cho: 2, pha: 2, trm: 2, flg: 2, looper: 60 });
  const at = (pool) => lanes.findIndex((l) => l.pool === pool);
  lanes.splice(at('drv'), 0, { pool: 'aco', algo: 'acoustic', n: 1, opts: { mode: 0, type: 0 } });
  lanes.splice(at('cab') + 1, 0, { pool: 'tc', algo: 'peq', n: 1 });
  lanes.splice(at('out'), 0, { pool: 'glb', algo: 'peq', n: 1, keep: true });
  const GE = ['LOW', 'MID', 'HIGH', 'LEVEL'];
  const ge = kit.unit({
    id: 'mooer.gn300', slots: 14, knobs: 5, cats: CATS, models: LIB, exp: true, memPrefix: 'PRESET',
    slotCats: CATS.map((c) => [c.key]),
    lanes,
    extra: (ui, o) => {
      const g = [0, 1, 2, 3].map((i) => ui[`_ge${i}`] ?? 0);
      o['glb.on'] = g.some((x) => Math.abs(x) > 0.05) ? 1 : 0;
      Object.assign(o, { 'glb.lowgain': g[0], 'glb.lowfreq': 120, 'glb.mid1gain': g[1], 'glb.mid1freq': 900, 'glb.mid1q': 0.7, 'glb.highgain': g[2], 'glb.highfreq': 4500, 'glb.level': g[3] });
    },
    patch: [['SAW LEAD', false], ['Studio Comp', true, { SUSTAIN: 0.4 }], ['Vintage Wah', false], ['Chorus', false], ['Gold Klone', true], ['UK 800', true, { GAIN: 0.5 }], ['4X12 GB', true], ['Noise Gate', true, { THRESH: 0.25 }], ['SC > HB', false], ['Graphic EQ', false], ['Phaser', false], ['Analog', true, { MIX: 0.22 }], ['Hall', true, { MIX: 0.22 }], ['Volume', true]],
    mems: [
      { name: 'BRIT CRUNCH' },
      { name: 'CLEAN SHIMMER', patch: [null, ['Studio Comp', true], null, ['Tri Chorus', true], null, ['Twin Clean', true], ['2X12 TWIN', true], null, null, null, null, ['Digital', true, { MIX: 0.2 }], ['Shimmer', true, { MIX: 0.35 }], ['Volume', true]] },
      { name: 'BROWN LEAD', patch: [null, null, ['Vintage Wah', false], null, ['Green Drive', true, { GAIN: 0.2, LEVEL: 0.7 }], ['Brown Sound', true], ['4X12 V30', true], ['Noise Gate', true, { THRESH: 0.4 }], null, ['Para EQ', false], ['Flanger', false], ['Analog', true, { MIX: 0.25 }], ['Room', true, { MIX: 0.18 }], ['Volume', true]] },
      { name: 'SYNTH STRINGS', patch: [['STRINGS', true, { DRY: 0.3, WET: 0.8 }], ['Squash Comp', true], null, ['Chorus', true], null, ['Deluxe Rev', true, { GAIN: 0.3 }], ['1X12 US', true], null, null, null, null, ['Ping Pong', true, { MIX: 0.3 }], ['Cloud', true, { MIX: 0.4 }], ['Volume', true]] },
    ],
  });

  // ---------------------------------------------------------------- screen: teal-on-navy, Oswald, node chain
  const C = { bg: '#08141d', bar: '#0e2230', acc: '#2ee6cf', ink: '#e8f7f6', dim: '#6a8796', line: '#1d3a4a' };
  const OF = "'Oswald', 'DejaVu Sans Condensed', 'Arial Narrow', sans-serif";
  const NM = 16;
  const pname = (m) => `P${String(Math.floor(m / 4) + 1).padStart(2, '0')}${'ABCD'[m % 4]}`;
  const EXPN = ['AUTO', 'VOLUME', 'WAH', 'OFF'];
  const CTLF = [...CATS.map((c) => c.name), 'TAP', 'LOOPER'];
  const DEF_CTL = [4, 3, 11, 14];
  const ctlOf = (ui, i) => ui[`_ct${i}`] ?? DEF_CTL[i];
  const SYS = [
    { label: 'EXP 1 FUNCTION', get: (ui) => EXPN[ui._expT ?? 0], step: (blk, ui, d) => tz.app.setParam(blk.id, '_expT', ((ui._expT ?? 0) + d + 4) % 4) },
    { label: 'CTRL ASSIGN', get: () => '›', sub: 'ctl' },
    { label: 'TEMPO', get: (ui) => `${ui._bpm || 120} BPM`, step: (blk, ui, d) => A.setBpm(blk, (ui._bpm || 120) + d) },
    { label: 'GLOBAL EQ', get: () => '›', sub: 'geq' },
    { label: 'LOOPER', get: () => '›', sub: 'loop' },
    { label: 'PRESET INIT', get: () => 'PUSH', act: (blk) => { A.init(blk); tz.ui.toast('Preset initialised', 'ok', 1000); } },
  ];

  tz.addScreen('gn300-lcd', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      R(g, 0, 0, w, h, { fill: C.bg });
      R(g, 0, 0, w, 13, { fill: C.bar });
      s.pNum = T(g, 4, 6.8, '', { anchor: 'start', size: 7.4, fill: C.acc, font: OF, weight: 700, ls: 0.4 });
      s.pName = T(g, 31, 6.8, '', { anchor: 'start', size: 6.6, fill: C.ink, font: OF, weight: 600, ls: 0.5 });
      s.pRight = T(g, w - 4, 6.8, '', { anchor: 'end', size: 4.4, fill: C.dim, font: OF, ls: 0.4 });
      const V = (n) => (s[n] = svg('g', {}, g));
      // HOME: 14 nodes, 2 rows of 7 joined by a wire
      V('vHome');
      const nx = (i) => 12 + (i % 7) * ((w - 24) / 6), ny = (i) => (i < 7 ? 25 : 45);
      svg('path', { d: `M${nx(0)} 25 H${nx(6)} Q${w - 4} 25 ${w - 4} 35 Q${w - 4} 45 ${nx(6)} 45 H${nx(0)}`, fill: 'none', stroke: C.line, 'stroke-width': 1.4 }, s.vHome);
      s.nodes = CATS.map((c, k) => {
        // second row runs right to left (the wire turns at the right edge)
        const i = k < 7 ? k : 13 - (k - 7);
        const x = nx(i), y = ny(k);
        const ring = svg('circle', { cx: x, cy: y, r: 7.2, fill: 'none', stroke: 'none', 'stroke-width': 1 }, s.vHome);
        const dot = svg('circle', { cx: x, cy: y, r: 5.6, fill: '#13293a', stroke: c.color, 'stroke-width': 0.8 }, s.vHome);
        const t = T(s.vHome, x, y + 0.3, c.key, { size: 3.4, fill: C.ink, font: OF, weight: 600 });
        return { x, y, ring, dot, t };
      });
      s.mName = T(s.vHome, 4, 60, '', { anchor: 'start', size: 4.2, fill: C.dim, font: OF, ls: 0.6 });
      s.mModel = T(s.vHome, 4, 68.5, '', { anchor: 'start', size: 8, fill: C.ink, font: OF, weight: 700, ls: 0.4 });
      s.mOn = T(s.vHome, w - 4, 66, '', { anchor: 'end', size: 5.4, fill: C.acc, font: OF, weight: 700, ls: 0.6 });
      s.cells = [0, 1, 2, 3, 4].map((k) => {
        const cw = (w - 6) / 5, x = 3 + k * cw;
        R(s.vHome, x + 0.5, 75, cw - 1, h - 77, { rx: 1.5, fill: '#0d1f2b' });
        return { l: T(s.vHome, x + cw / 2, 79.5, '', { size: 3.3, fill: C.dim, font: OF, ls: 0.3 }), v: T(s.vHome, x + cw / 2, h - 6, '', { size: 6.2, fill: C.ink, font: OF, weight: 600 }) };
      });
      // EDIT: 5 vertical meters (P1-P5)
      V('vEdit');
      s.eTag = R(s.vEdit, 3, 16, 30, 9, { rx: 4.5, fill: '#555' });
      s.eTagT = T(s.vEdit, 18, 20.7, '', { size: 4.2, fill: '#071016', font: OF, weight: 700 });
      s.eModel = T(s.vEdit, w / 2 + 10, 20.7, '', { size: 7, fill: C.ink, font: OF, weight: 600, ls: 0.4 });
      s.eArrows = T(s.vEdit, w / 2 + 10, 20.7, '', { size: 6, fill: C.acc, font: OF });
      s.eOn = T(s.vEdit, w - 4, 20.7, '', { anchor: 'end', size: 4.8, fill: C.acc, font: OF, weight: 700 });
      s.meters = [0, 1, 2, 3, 4].map((k) => {
        const cw = (w - 6) / 5, x = 3 + k * cw + cw / 2;
        R(s.vEdit, x - 3, 30, 6, 38, { rx: 3, fill: '#0f2533' });
        const fill = R(s.vEdit, x - 3, 68, 6, 0, { rx: 3, fill: C.acc });
        const l = T(s.vEdit, x, 74, '', { size: 3.6, fill: C.dim, font: OF, ls: 0.3 });
        const val = T(s.vEdit, x, 82, '', { size: 5.4, fill: C.ink, font: OF, weight: 600 });
        const num = T(s.vEdit, x, 28, `P${k + 1}`, { size: 3.2, fill: C.dim, font: OF });
        return { x, fill, l, val, num };
      });
      s.ePage = T(s.vEdit, w - 4, h - 2.5, '', { anchor: 'end', size: 3.4, fill: C.dim, font: OF });
      // LIST / SYSTEM / CTL (rows)
      V('vRows');
      s.rTitle = T(s.vRows, 4, 19.5, '', { anchor: 'start', size: 5, fill: C.acc, font: OF, weight: 600, ls: 0.8 });
      s.rows = [];
      for (let r = 0; r < 6; r++) {
        const y = 25 + r * 11;
        const bg = R(s.vRows, 2, y, w - 8, 10, { rx: 1.5, fill: 'none' });
        const l = T(s.vRows, 7, y + 5.2, '', { anchor: 'start', size: 5.4, fill: C.ink, font: OF, ls: 0.4 });
        const val = T(s.vRows, w - 10, y + 5.2, '', { anchor: 'end', size: 5, fill: C.dim, font: OF, ls: 0.4 });
        s.rows.push({ y, bg, l, val });
      }
      s.rsb = R(s.vRows, w - 4, 25, 2, 20, { rx: 1, fill: '#24485c' });
      // GLOBAL EQ
      V('vGeq');
      T(s.vGeq, 4, 19.5, 'GLOBAL EQ', { anchor: 'start', size: 5, fill: C.acc, font: OF, weight: 600, ls: 0.8 });
      s.geq = GE.map((nm, i) => {
        const x = 24 + i * ((w - 48) / 3);
        svg('line', { x1: x, x2: x, y1: 26, y2: 70, stroke: '#1d3a4a', 'stroke-width': 2, 'stroke-linecap': 'round' }, s.vGeq);
        svg('line', { x1: x - 5, x2: x + 5, y1: 48, y2: 48, stroke: '#24485c', 'stroke-width': 0.6 }, s.vGeq);
        const cap = R(s.vGeq, x - 7, 45, 14, 6, { rx: 2, fill: C.ink });
        const l = T(s.vGeq, x, 77, nm, { size: 4.2, fill: C.dim, font: OF, ls: 0.5 });
        const val = T(s.vGeq, x, 84, '', { size: 4.8, fill: C.ink, font: OF, weight: 600 });
        return { x, cap, l, val };
      });
      // EXP view
      V('vExp');
      T(s.vExp, 4, 19.5, 'EXPRESSION PEDAL', { anchor: 'start', size: 5, fill: C.acc, font: OF, weight: 600, ls: 0.8 });
      s.xFn = T(s.vExp, w / 2, 40, '', { size: 11, fill: C.ink, font: OF, weight: 700, ls: 1 });
      R(s.vExp, 20, 56, w - 40, 6, { rx: 3, fill: '#0f2533' });
      s.xBar = R(s.vExp, 20, 56, 0, 6, { rx: 3, fill: C.acc });
      s.xPos = T(s.vExp, w / 2, 70, '', { size: 5, fill: C.dim, font: OF });
      T(s.vExp, w / 2, h - 5, '◀ ▶ / SELECT: FUNCTION · EXIT WITH EXP', { size: 3.6, fill: C.dim, font: OF, ls: 0.4 });
      // LOOPER
      V('vLoop');
      T(s.vLoop, 4, 19.5, 'LOOPER', { anchor: 'start', size: 5, fill: C.acc, font: OF, weight: 600, ls: 0.8 });
      s.lSt = T(s.vLoop, w / 2, 38, '', { size: 14, fill: C.ink, font: OF, weight: 700, ls: 1.2 });
      R(s.vLoop, 14, 50, w - 28, 5, { rx: 2.5, fill: '#0f2533' });
      s.lBar = R(s.vLoop, 14, 50, 0, 5, { rx: 2.5, fill: '#5cff6e' });
      s.lLen = T(s.vLoop, w / 2, 62, '', { size: 5, fill: C.dim, font: OF });
      ['A  REC/PLAY', 'B  STOP', 'C  UNDO', 'D  CLEAR'].forEach((t, i) => T(s.vLoop, 8 + i * ((w - 16) / 4) + (w - 16) / 8, 78, t, { size: 4.2, fill: C.ink, font: OF, ls: 0.3 }));
      // LIVE (performance view)
      V('vLive');
      s.vNum = T(s.vLive, w / 2, 32, '', { size: 16, fill: C.acc, font: OF, weight: 700, ls: 1 });
      s.vName = T(s.vLive, w / 2, 50, '', { size: 10, fill: C.ink, font: OF, weight: 600, ls: 0.8 });
      s.vCtl = [0, 1, 2, 3].map((i) => {
        const cw = (w - 8) / 4, x = 4 + i * cw;
        const bg = R(s.vLive, x + 1, 64, cw - 2, 26, { rx: 2, fill: '#0d1f2b', stroke: C.line, 'stroke-width': 0.6 });
        T(s.vLive, x + cw / 2, 70, `CTRL ${i + 1}`, { size: 3.4, fill: C.dim, font: OF, ls: 0.4 });
        const t = T(s.vLive, x + cw / 2, 80, '', { size: 5.2, fill: C.ink, font: OF, weight: 600 });
        return { bg, t };
      });
      // SAVE
      V('vSave');
      R(s.vSave, 0, 13, w, h - 13, { fill: C.bg });
      T(s.vSave, w / 2, 28, 'SAVE TO', { size: 5, fill: C.dim, font: OF, ls: 1.4 });
      s.sTo = T(s.vSave, w / 2, 46, '', { size: 18, fill: C.acc, font: OF, weight: 700, ls: 1 });
      s.sNm = T(s.vSave, w / 2, 62, '', { size: 6, fill: C.ink, font: OF, ls: 0.6 });
      T(s.vSave, w / 2, h - 8, 'SELECT / ◀ ▶ = LOCATION · PUSH / SAVE = STORE', { size: 3.6, fill: C.dim, font: OF, ls: 0.3 });
      s.views = ['vHome', 'vEdit', 'vRows', 'vGeq', 'vExp', 'vLoop', 'vLive', 'vSave'];
      s.sig = '';
    },
    update(s, status, view, now) {
      const blk = view.block, ui = s.ui, n = nav(blk.id), w = s.w;
      const vn = { home: 'vHome', edit: 'vEdit', list: 'vRows', sys: 'vRows', ctl: 'vRows', geq: 'vGeq', exp: 'vExp', loop: 'vLoop', live: 'vLive', save: 'vSave' }[n.view] || 'vHome';
      if (s.curV !== vn) { for (const k of s.views) sa(s[k], 'display', k === vn ? 'inline' : 'none'); s.curV = vn; }
      if (vn === 'vExp') {
        const e = ui.exp ?? 1;
        sa(s.xBar, 'width', (e * (w - 40)).toFixed(1));
        st(s.xPos, `PEDAL ${Math.round(e * 100)}%`);
      }
      if (vn === 'vLoop') {
        const tr = status?.lpr?.looper?.tracks?.[0];
        const k = tr ? tr.state : 0;
        st(s.lSt, ['READY', 'RECORDING', 'PLAYING', 'OVERDUB', 'STOPPED'][k]);
        sa(s.lSt, 'fill', ['#e8f7f6', '#ff4b3f', '#5cff6e', '#ffd23f', '#e8f7f6'][k]);
        sa(s.lBar, 'width', ((tr ? (k === 1 ? (now % 2000) / 2000 : tr.pos || 0) : 0) * (w - 28)).toFixed(1));
        st(s.lLen, tr && tr.len ? `${tr.len.toFixed(1)} s` : '0.0 s');
      }
      let sig = `${n.view}|${n.t}|${n.sel}|${n.page}|${n.li}|${n.top}|${n.edit ? 1 : 0}|${n.saveTo}|${n.gb}|${ui._cur}|${ui._bpm}|${ui._expT}|${n.bank}`;
      for (let i = 0; i < 14; i++) sig += `|${ui['_m' + i]}${ui['_o' + i]}`;
      for (let k = 0; k < 10; k++) sig += `|${(ui[`_p${n.sel}_${k}`] ?? 0).toFixed(3)}`;
      for (let i = 0; i < 4; i++) sig += `|${ui['_ct' + i]}|${ui['_ge' + i]}`;
      if (sig === s.sig) return;
      s.sig = sig;
      const cur = ui._cur | 0;
      st(s.pNum, pname(cur));
      st(s.pName, A.memName(blk, cur));
      st(s.pRight, `BANK ${String((n.bank ?? Math.floor(cur / 4)) + 1).padStart(2, '0')} · ${ui._bpm || 120} BPM`);
      const Al = ge.alloc(ui);
      const x = ge.slot(ui, n.sel, Al);
      if (vn === 'vHome') {
        s.nodes.forEach((nd, i) => {
          const y = ge.slot(ui, i, Al);
          const c = CATS[i].color;
          sa(nd.dot, 'fill', y.m && y.on ? c : '#13293a');
          sa(nd.t, 'fill', y.m && y.on ? '#071016' : y.m ? C.ink : '#3f5a69');
          sa(nd.ring, 'stroke', i === n.sel ? '#ffffff' : 'none');
        });
        st(s.mName, `${CATS[n.sel].name}${x.over ? ' · DSP FULL' : ''}`);
        st(s.mModel, x.m ? x.m.name : '-');
        st(s.mOn, x.m ? (x.on ? 'ON' : 'OFF') : '');
        sa(s.mOn, 'fill', x.on ? CATS[n.sel].color : C.dim);
        s.cells.forEach((c, k) => { const p = x.m && x.m.params[n.page * 5 + k]; st(c.l, p ? p.label : ''); st(c.v, p ? fmt(p, x.val(n.page * 5 + k)) : ''); });
      } else if (vn === 'vEdit') {
        const c = CATS[n.sel];
        sa(s.eTag, 'fill', c.color);
        st(s.eTagT, c.key);
        st(s.eModel, x.m ? x.m.name : '-');
        st(s.eArrows, '');
        st(s.eOn, x.m ? (x.on ? 'ON' : 'OFF') : '');
        sa(s.eOn, 'fill', x.on ? c.color : C.dim);
        s.meters.forEach((m, k) => {
          const pi = n.page * 5 + k, p = x.m && x.m.params[pi];
          const vv = p ? x.val(pi) : 0;
          sa(m.fill, 'y', (68 - vv * 38).toFixed(1));
          sa(m.fill, 'height', (vv * 38).toFixed(1));
          sa(m.fill, 'fill', p ? c.color : 'none');
          st(m.l, p ? p.label : '');
          st(m.val, p ? fmt(p, vv) : '');
        });
        st(s.ePage, x.m ? `PAGE ${n.page + 1}/${A.pages(blk)}` : '');
      } else if (vn === 'vRows') {
        let rows, title;
        if (n.view === 'list') {
          const list = ge.inCat(CATS[n.sel].key);
          title = `${CATS[n.sel].name} · MODELS`;
          rows = list.map((m) => ({ l: m.name, v: x.m && m.idx === x.m.idx ? '●' : '' }));
        } else if (n.view === 'sys') {
          title = 'SYSTEM';
          rows = SYS.map((it, j) => ({ l: it.label, v: n.edit && j === n.li ? `◀ ${it.get(ui)} ▶` : it.get(ui) }));
        } else {
          title = 'CTRL ASSIGN';
          rows = [0, 1, 2, 3].map((i) => ({ l: `CTRL ${i + 1}`, v: n.edit && i === n.li ? `◀ ${CTLF[ctlOf(ui, i)]} ▶` : CTLF[ctlOf(ui, i)] }));
        }
        st(s.rTitle, title);
        s.rows.forEach((r, j) => {
          const it = rows[(n.top | 0) + j];
          const hl = (n.top | 0) + j === n.li;
          st(r.l, it ? it.l : '');
          st(r.val, it ? it.v : '');
          sa(r.bg, 'fill', it && hl ? (n.edit ? C.acc : '#123546') : 'none');
          sa(r.l, 'fill', hl && n.edit ? '#071016' : C.ink);
          sa(r.val, 'fill', hl && n.edit ? '#071016' : hl ? C.acc : C.dim);
        });
        const tot = Math.max(1, rows.length);
        sa(s.rsb, 'height', (Math.min(1, 6 / tot) * 66).toFixed(1));
        sa(s.rsb, 'y', (25 + ((n.top | 0) / tot) * 66).toFixed(1));
      } else if (vn === 'vGeq') {
        s.geq.forEach((b, i) => {
          const g = ui[`_ge${i}`] ?? 0;
          sa(b.cap, 'y', (48 - 3 - (g / 12) * 22).toFixed(1));
          sa(b.cap, 'fill', i === (n.gb | 0) ? C.acc : C.ink);
          st(b.val, `${g > 0 ? '+' : ''}${g.toFixed(1)}`);
          sa(b.l, 'fill', i === (n.gb | 0) ? C.acc : C.dim);
        });
      } else if (vn === 'vExp') {
        st(s.xFn, EXPN[ui._expT ?? 0]);
      } else if (vn === 'vLive') {
        st(s.vNum, pname(cur));
        st(s.vName, A.memName(blk, cur));
        s.vCtl.forEach((c, i) => {
          const f = ctlOf(ui, i);
          st(c.t, CTLF[f]);
          const on = f < 14 && ge.slot(ui, f, Al).on;
          sa(c.bg, 'stroke', on ? CATS[f].color : C.line);
        });
      } else if (vn === 'vSave') {
        const to = n.saveTo ?? cur;
        st(s.sTo, pname(to));
        st(s.sNm, A.memName(blk, to));
      }
    },
    pointer(s, view, type, pt, e) {
      const blk = view.block, n = nav(blk.id), ui = tz.app.ui(blk), w = s.w;
      if (type === 'wheel') { go(blk, e.deltaY > 0 ? 'right' : 'left'); return; }
      if (type === 'move' && s.drag) {
        if (s.drag.geq != null) { const g = s.drag.g0 - (pt.y - s.drag.y0) / 25 * 12; tz.app.setParam(blk.id, `_ge${s.drag.geq}`, Math.round(Math.max(-12, Math.min(12, g)) * 2) / 2); kit.bump(blk); }
        else A.setVal(blk, n.sel, s.drag.k, s.drag.v0 + (s.drag.y0 - pt.y) / 38);
        return;
      }
      if (type === 'up') { s.drag = null; return; }
      if (type !== 'down') return;
      s.sig = '';
      if (pt.y < 13) { A.view(blk, n.view === 'live' ? 'home' : 'live'); return; }
      switch (n.view) {
        case 'home': {
          const i = s.nodes.findIndex((nd) => Math.hypot(pt.x - nd.x, pt.y - nd.y) < 8);
          if (i >= 0) { if (i === n.sel) A.view(blk, 'edit'); else A.select(blk, i); return; }
          if (pt.y > 52 && pt.y < 74) { if (pt.x > w - 24) A.toggle(blk, n.sel); else A.view(blk, 'edit'); }
          else if (pt.y >= 74) A.page(blk, 1);
          return;
        }
        case 'edit': {
          if (pt.y < 27) { if (pt.x < 34) A.view(blk, 'home'); else if (pt.x > w - 22) A.toggle(blk, n.sel); else openList(blk); return; }
          const k = s.meters.findIndex((m) => Math.abs(pt.x - m.x) < (w - 6) / 10);
          const pi = n.page * 5 + k;
          const x = ge.slot(ui, n.sel);
          if (k >= 0 && x.m && x.m.params[pi]) s.drag = { k: pi, v0: x.val(pi), y0: pt.y };
          return;
        }
        case 'list': case 'sys': case 'ctl': {
          const j = Math.floor((pt.y - 25) / 11);
          if (j < 0 || j > 5) return;
          const idx = (n.top | 0) + j;
          if (n.view === 'list' || idx !== n.li) { n.li = idx; n.edit = false; }
          go(blk, 'push');
          return;
        }
        case 'geq': {
          const i = s.geq.findIndex((b) => Math.abs(pt.x - b.x) < 14);
          if (i >= 0) { n.gb = i; s.drag = { geq: i, g0: ui[`_ge${i}`] ?? 0, y0: pt.y }; kit.bump(blk); }
          return;
        }
        case 'exp': go(blk, pt.x < w / 2 ? 'left' : 'right'); return;
        case 'loop': { const i = Math.floor((pt.x - 8) / ((w - 16) / 4)); if (pt.y > 68 && i >= 0 && i < 4) A.loop(blk, [1, 2, 4, 3][i]); return; }
        case 'live': { const i = Math.floor((pt.x - 4) / ((w - 8) / 4)); if (pt.y > 62 && i >= 0 && i < 4) ctlPress(blk, i); return; }
        case 'save': go(blk, pt.x < w / 2 ? 'left' : 'right'); return;
      }
    },
  });
  function openList(blk) {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    const list = ge.inCat(CATS[n.sel].key);
    A.view(blk, 'list');
    n.li = Math.max(0, list.findIndex((m) => m.idx === (ui[`_m${n.sel}`] ?? -1)));
    n.top = Math.max(0, Math.min(Math.max(0, list.length - 6), n.li - 2));
  }
  const rowsLen = (blk) => { const n = nav(blk.id); return n.view === 'list' ? ge.inCat(CATS[n.sel].key).length : n.view === 'sys' ? SYS.length : 4; };
  // SELECT turn = left / right, SELECT push = push, plus EXIT-like behaviour of the system buttons
  function go(blk, key) {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    const d = key === 'left' ? -1 : key === 'right' ? 1 : 0;
    switch (n.view) {
      case 'home': case 'live':
        if (d) { if (n.view === 'live') A.view(blk, 'home'); A.selMove(blk, d); }
        else if (key === 'push') A.view(blk, 'edit');
        break;
      case 'edit':
        if (d) A.page(blk, d);
        else if (key === 'push') openList(blk);
        else if (key === 'exit') A.view(blk, 'home');
        break;
      case 'list': case 'sys': case 'ctl': {
        const L = rowsLen(blk);
        if (n.edit) {
          if (d && n.view === 'sys') { const it = SYS[n.li]; if (it.step) it.step(blk, ui, d); }
          else if (d && n.view === 'ctl') tz.app.setParam(blk.id, `_ct${n.li}`, (ctlOf(ui, n.li) + d + CTLF.length) % CTLF.length);
          else if (key === 'push' || key === 'exit') n.edit = false;
        } else if (d) { n.li = Math.max(0, Math.min(L - 1, n.li + d)); n.top = Math.max(0, Math.min(n.li, Math.max(n.top | 0, n.li - 5))); }
        else if (key === 'push') {
          if (n.view === 'list') { const m = ge.inCat(CATS[n.sel].key)[n.li]; if (m) { A.setModel(blk, n.sel, m.idx); A.view(blk, 'edit'); } }
          else if (n.view === 'sys') { const it = SYS[n.li]; if (it.sub) { A.view(blk, it.sub); n.li = 0; } else if (it.act) it.act(blk); else n.edit = true; }
          else n.edit = true;
        } else if (key === 'exit') { if (n.view === 'list') A.view(blk, 'edit'); else if (n.view === 'ctl') { A.view(blk, 'sys'); n.li = 1; } else A.view(blk, 'home'); }
        break;
      }
      case 'geq':
        if (d) { const g = ui[`_ge${n.gb | 0}`] ?? 0; tz.app.setParam(blk.id, `_ge${n.gb | 0}`, Math.max(-12, Math.min(12, g + d * 0.5))); }
        else if (key === 'push') n.gb = ((n.gb | 0) + 1) % 4;
        else if (key === 'exit') A.view(blk, 'home');
        break;
      case 'exp':
        if (d) tz.app.setParam(blk.id, '_expT', ((ui._expT ?? 0) + d + 4) % 4);
        else if (key === 'exit' || key === 'push') A.view(blk, 'home');
        break;
      case 'loop':
        if (key === 'exit' || d) A.view(blk, 'home');
        break;
      case 'save':
        if (d) n.saveTo = (((n.saveTo ?? ui._cur) | 0) + d + NM) % NM;
        else if (key === 'push' || key === 'save') { A.store(blk, n.saveTo ?? (ui._cur | 0)); A.view(blk, 'home'); }
        else if (key === 'exit') A.view(blk, 'home');
        break;
    }
    kit.bump(blk);
  }
  function ctlPress(blk, i) {
    const ui = tz.app.ui(blk);
    const f = ctlOf(ui, i);
    if (f < 14) A.toggle(blk, f);
    else if (f === 14) A.tap(blk);
    else A.view(blk, nav(blk.id).view === 'loop' ? 'home' : 'loop');
  }
  // SELECT encoder: knob turn = steps (delta based, like an endless encoder)
  tz.bus.on('param', ({ id, p, v: val }) => {
    if (p !== 'ksel') return;
    const blk = kit.blockOf(id);
    if (!blk || blk.type !== 'mooer.gn300') return;
    const n = nav(id);
    const prev = n.selLast ?? val;
    n.selLast = val;
    n.selAcc = (n.selAcc || 0) + (val - prev);
    while (Math.abs(n.selAcc) >= 0.0499) { const d = n.selAcc > 0 ? 1 : -1; n.selAcc -= d * 0.05; go(blk, d > 0 ? 'right' : 'left'); }
  });

  kit.hooks('mooer.gn300', (blk, name, ctl, phase) => {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    if (name.startsWith('ctrl')) { if (phase === 'down') ctlPress(blk, +name.slice(4)); return; }
    if (name.startsWith('mb')) {
      if (phase !== 'press') return;
      const i = +name.slice(2);
      if (n.sel === i && (n.view === 'edit' || n.view === 'home')) A.toggle(blk, i);
      else { A.select(blk, i); A.view(blk, 'edit'); }
      return;
    }
    if (name.startsWith('fs')) {
      const i = +name.slice(2);
      if (n.view === 'loop') { if (phase === 'down') A.loop(blk, [1, 2, 4, 3][i]); return; }
      const m = (n.bank ?? Math.floor((ui._cur | 0) / 4)) * 4 + i;
      if (phase === 'hold') A.store(blk, m);
      else if (phase === 'press') A.recall(blk, m);
      return;
    }
    if (phase !== 'press') return;
    switch (name) {
      case 'bank': n.bank = (((n.bank ?? Math.floor((ui._cur | 0) / 4)) + ctl.dir + 4) % 4); kit.bump(blk); break;
      case 'left': case 'right': case 'push': go(blk, name); break;
      case 'display': A.view(blk, { home: 'live', live: 'loop', loop: 'home' }[n.view] || 'home'); break;
      case 'glbeq': A.view(blk, n.view === 'geq' ? 'home' : 'geq'); break;
      case 'ctl': A.view(blk, n.view === 'ctl' ? 'home' : 'ctl'); n.edit = false; break;
      case 'system': A.view(blk, n.view === 'sys' ? 'home' : 'sys'); n.edit = false; break;
      case 'exp': A.view(blk, n.view === 'exp' ? 'home' : 'exp'); break;
      case 'save': if (n.view === 'save') go(blk, 'save'); else { A.view(blk, 'save'); n.saveTo = ui._cur | 0; } break;
    }
  });

  // ---------------------------------------------------------------- enclosure
  tz.addForm('mooer-gn300', (ctx, d) => {
    const g = ctx.g, w = 572, h = 296;
    formKit.body(g, w, h, d.color, { rx: 10, brushed: true });
    svg('rect', { x: 8, y: 8, width: 482, height: 158, rx: 6, fill: '#1b1c1f', stroke: '#000', 'stroke-opacity': 0.6 }, g);
    svg('rect', { x: 8, y: 170, width: 482, height: 118, rx: 6, fill: '#141518', stroke: '#000', 'stroke-opacity': 0.6 }, g);
    svg('rect', { x: 498, y: 8, width: 66, height: 280, rx: 8, fill: '#0c0d0e', stroke: '#000' }, g);
    const txt = '#e9ecef', dim = '#8b939b';
    const cap = (x, y, t, ww = 26, hh = 9) => {
      svg('rect', { x: x - ww / 2 - 0.5, y: y - hh / 2 + 0.6, width: ww + 1, height: hh + 1, rx: 2.2, fill: '#000', opacity: 0.6 }, g);
      svg('rect', { x: x - ww / 2, y: y - hh / 2, width: ww, height: hh, rx: 2.2, fill: '#3a3d42', stroke: '#0b0b0b', 'stroke-width': 0.5 }, g);
      label(g, x, y + 0.2, t, { size: 3.8, fill: txt, weight: 800, ls: 0.2 });
    };
    [['DISPLAY', 26, 30], ['GLB-EQ', 58, 30], ['CTL', 26, 50], ['SYSTEM', 58, 50], ['SAVE', 26, 70], ['EXP', 58, 70]].forEach(([t, x, y]) => cap(x, y, t, 28));
    cap(308, 92, '◀', 18); cap(348, 92, '▶', 18);
    CATS.forEach((c, i) => cap(34 + i * 33.6, 157, c.name, 29));
    label(g, 42, 110, 'GN300', { size: 16, fill: '#fff', font: "'Oswald', sans-serif", weight: 700, ls: 1.6 });
    label(g, 42, 121, 'GRAND ENGINE', { size: 4.4, fill: '#2ee6cf', weight: 800, ls: 1.4 });
    label(g, 328, 70, 'SELECT', { size: 4.2, fill: dim, weight: 800, ls: 1.2 });
    ['CTRL 1', 'CTRL 2', 'CTRL 3', 'CTRL 4', 'BANK ▲'].forEach((t, i) => label(g, 58 + i * 96, 220, t, { size: 4.6, fill: dim, weight: 800, ls: 0.8 }));
    ['A', 'B', 'C', 'D', 'BANK ▼'].forEach((t, i) => label(g, 58 + i * 96, 282, t, { size: i < 4 ? 6.4 : 4.6, fill: i < 4 ? txt : dim, weight: 800 }));
    label(g, 531, 282, 'EXP 1', { size: 4.8, fill: dim, weight: 800, ls: 1 });
    formKit.tzBadge(g, 440, 120, '#5d636b', 3.8);
    const theme = { text: txt, knob: 'chrome', labelSize: 4.6 };
    formKit.placeControls(ctx, d.controls, theme);
    const jacks = formKit.jacksTop(d, w, { flip: ctx.flip });
    jacks.push({ key: 'ic0', dir: 'in', port: 'c0', label: 'EXP 2', side: 'top', x: ctx.flip ? w - 30 : 30, y: -2, kind: 'ctrl' });
    return { w, h, theme, jacks };
  });
  const fsLed = (i) => (ui, b, stt, now) => {
    const n = nav(b.id);
    if (n.view === 'loop') {
      const tr = stt?.lpr?.looper?.tracks?.[0];
      if (!tr) return null;
      if (i === 0) return tr.state === 1 ? (now % 500 < 250 ? '#ff3030' : null) : tr.state === 2 ? '#5cff6e' : tr.state === 3 ? '#ffd23f' : null;
      return i === 1 && tr.state === 4 ? '#ffffff' : null;
    }
    return (ui._cur | 0) === (n.bank ?? Math.floor((ui._cur | 0) / 4)) * 4 + i ? '#2ee6cf' : null;
  };
  const ctlLed = (i) => (ui, b, stt, now) => {
    const f = ctlOf(ui, i);
    if (f < 14) { const x = ge.slot(ui, f); return x.m && x.on ? CATS[f].color : null; }
    if (f === 14) return (now / (60000 / (ui._bpm || 120))) % 1 < 0.15 ? '#ffffff' : null;
    return nav(b.id).view === 'loop' ? '#5cff6e' : null;
  };
  const controls = [
    Object.assign(SCREEN('gn300-lcd', { interactive: true }), { x: 186, y: 60, w: 164, h: 90, bezel: '#050505' }),
    Object.assign(K('ksel', '', { virtual: true, def: 0.5 }), { x: 328, y: 46, r: 15, labelPos: 'none', style: 'chrome' }),
    Object.assign(FOOT({ action: 'nav', nav: 'push', style: 'plate', label: '' }), { x: 328, y: 46, w: 9, h: 9 }),
    Object.assign(K('_lvl', 'MASTER', { virtual: true, min: -24, max: 12, def: 0, display: (x) => (x > 0 ? '+' : '') + x.toFixed(1) + ' dB' }), { x: 400, y: 46, r: 14, labelPos: 'below' }),
    ...[0, 1, 2, 3, 4].map((k) => Object.assign(K('k' + (k + 1), `P${k + 1}`, { virtual: true, def: 0.5 }), { x: 122 + k * 32, y: 120, r: 10, labelPos: 'below' })),
    ...[['display', 26, 30], ['glbeq', 58, 30], ['ctl', 26, 50], ['system', 58, 50], ['save', 26, 70], ['exp', 58, 70], ['left', 308, 92], ['right', 348, 92]].map(([nm, x, y]) => Object.assign(FOOT({ action: 'nav', nav: nm, style: 'plate', label: '' }), { x, y, w: nm === 'left' || nm === 'right' ? 18 : 28, h: 9 })),
    ...CATS.map((c, i) => Object.assign(FOOT({ action: 'nav', nav: 'mb' + i, style: 'plate', label: '' }), { x: 34 + i * 33.6, y: 157, w: 29, h: 9 })),
    ...CATS.map((c, i) => Object.assign(LED({ bind: 'fn', color: c.color, ledFn: (ui) => { const x = ge.slot(ui, i); return x.m && x.on ? c.color : null; } }), { x: 34 + i * 33.6, y: 148.5, r: 1.5 })),
    ...[0, 1, 2, 3].map((i) => Object.assign(FOOT({ action: 'nav', nav: 'ctrl' + i, style: 'stomp', label: '' }), { x: 58 + i * 96, y: 198, r: 12 })),
    ...[0, 1, 2, 3].map((i) => Object.assign(LED({ bind: 'fn', ledFn: ctlLed(i) }), { x: 78 + i * 96, y: 198, r: 2.4 })),
    Object.assign(FOOT({ action: 'nav', nav: 'bank', dir: 1, style: 'stomp', label: '' }), { x: 442, y: 198, r: 12 }),
    ...[0, 1, 2, 3].map((i) => Object.assign(FOOT({ action: 'nav', nav: 'fs' + i, style: 'stomp', label: '', holdMs: 900 }), { x: 58 + i * 96, y: 258, r: 13 })),
    ...[0, 1, 2, 3].map((i) => Object.assign(LED({ bind: 'fn', ledFn: fsLed(i) }), { x: 78 + i * 96, y: 258, r: 2.6 })),
    Object.assign(FOOT({ action: 'nav', nav: 'bank', dir: -1, style: 'stomp', label: '' }), { x: 442, y: 258, r: 12 }),
    Object.assign(TREADLE('exp', { virtual: true, def: 1, color: '#1a1b1d' }), { x: 531, y: 142, w: 54, h: 232 }),
  ];
  tz.addDefs([def({
    id: 'mooer.gn300', name: 'GN300 Grand Engine', ref: 'Mooer GE300', brand: 'Mooer', code: 'GN300', logo: 'GN300', typeName: 'Flagship multi-effects', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'mooer-gn300', color: '#25272b', stereo: 'stereo', ports: { ins: ['INPUT'], outs: ['OUTPUT L', 'OUTPUT R', 'XLR L', 'XLR R', 'PHONES'] }, jackKinds: { o2: 'xlr', o3: 'xlr', o4: 'phones' }, cost: 7.5, noBypassClick: true,
    ctrl: { ins: [{ label: 'EXP 2', param: 'exp' }] },
    algo: 'chain', opts: { chain: ge.chain }, derive: ge.derive,
    initParams: Object.assign({}, ge.initParams, { _expT: 0, _lvl: 0, exp: 1 }),
    controls,
    desc: 'Big floor unit with 14 modules, a synth, a looper, global EQ and ten footswitches. Turn and push SELECT to move through the chain and menus; A-D recall presets and CTRL 1-4 are assignable.',
  })]);
  kit.register('mooer.gn300', ge);
}
