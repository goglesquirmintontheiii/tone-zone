// Built-in Tone Zone plugin: Zoom.
// Multi-effects inspired by Zoom units. Names, logos and artwork are Tone Zone originals; layouts, colours and
// the way the screens work follow the real units (see each block's `ref`).
//  * zoom.zx6 : touchscreen floor unit (4.3" colour touchscreen, 4 footswitches with their own displays, bank
//                switches, play-mode buttons, 4 parameter knobs, expression pedal, looper).
//  * zoom.ss50: compact multi-stomp (small colour LCD, 4 knobs, ◀ ▶ / PAGE / TYPE buttons, chain of 6).
// Both share one effect library (the Zoom family sound) on the multi-FX kit (mfx-kit.js).
import { makeKit, stdParts, stdLanes } from './mfx-kit.js';

export default function register(tz) {
  const { K, FOOT, LED, SCREEN, TREADLE, def } = tz.helpers;
  const { svg, label, formKit, shade } = tz.gfx;
  const kit = makeKit(tz);
  const { P, A, T, R, st, sa, fmt, nav } = kit;
  const S = stdParts(P);

  // ---------------------------------------------------------------- library (Zoom-style categories & colours)
  const CATS = [
    { key: 'DYN', name: 'DYNAMICS', color: '#ffd23a' },
    { key: 'FLT', name: 'FILTER', color: '#ff9a2e' },
    { key: 'DRV', name: 'DRIVE', color: '#ff4040' },
    { key: 'AMP', name: 'AMP', color: '#ff5f9e' },
    { key: 'MOD', name: 'MODULATION', color: '#33c8ff' },
    { key: 'SFX', name: 'SFX', color: '#c86bff' },
    { key: 'DLY', name: 'DELAY', color: '#42e07a' },
    { key: 'REV', name: 'REVERB', color: '#8f8cff' },
    { key: 'PDL', name: 'PEDAL', color: '#d8dde6' },
  ];
  const CABS = ['1x12us', '2x12twin', '2x12blue', '4x12gb', '4x12v30', '4x12t75', '2x12jc', '4x12uber', '4x10tweed'];
  const CABN = ['1x12 US', '2x12 TW', '2x12 BL', '4x12 GB', '4x12 V30', '4x12 T75', '2x12 JC', '4x12 UB', '4x10 TW'];
  // amp + cab in one effect (like the real unit): the CAB param picks the unit's speaker lane
  const amp = (name, voice, cab, o = {}) => Object.assign({ name, cat: 'AMP' }, S.amp(voice, Object.assign({ extra: [P('CAB', null, CABS.indexOf(cab) / (CABS.length - 1), { opts: CABN })] }, o)), {
    fx: (out, v, pre) => {
      out['cab.on'] = out[pre + '.on'];
      out['cab.model'] = Math.round(v[6] * (CABS.length - 1));
      out['cab.m1pos'] = 0.35;
    },
  });
  const voc = {
    ts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 6, gainMaxDb: 40, tone: 'ts', toneLo: 723, postLp: 6500 },
    klon: { clip: 'si', cleanSum: true, cleanMix: 0.45, gainMinDb: 2, gainMaxDb: 34, tone: 'tilt', postLp: 9000 },
    rat: { clip: 'si', gainMinDb: 12, gainMaxDb: 52, tone: 'rat', postLp: 7000 },
    muff: { clip: 'muff', stages: 2, stage2Db: 12, gainMinDb: 16, gainMaxDb: 50, tone: 'blend', postLp: 6000 },
    fface: { clip: 'ge', gainMinDb: 14, gainMaxDb: 44, preHp: 40, tone: 'lp', postLp: 5000, bias: 0.3 },
    boost: { clip: 'clean', gainMinDb: 0, gainMaxDb: 20, tone: 'tilt' },
    metal: { clip: 'si', stages: 2, stage2Db: 18, gainMinDb: 20, gainMaxDb: 60, preHp: 140, tone: 'eq3', postLp: 7500 },
    sd: { clip: 'asym', gainMinDb: 6, gainMaxDb: 38, tone: 'lp', toneLo: 1200, toneHi: 7000, postLp: 7000 },
  };
  const LIB = [
    { name: 'Rack Comp', cat: 'DYN', ...S.comp('cmp') },
    { name: 'OptoSqueeze', cat: 'DYN', ...S.comp('cmpO') },
    { name: 'Noise Gate', cat: 'DYN', ...S.gate() },
    { name: 'Auto Wah', cat: 'FLT', ...S.wah(2) },
    { name: 'LFO Filter', cat: 'FLT', ...S.wah(1, 0) },
    { name: 'Graphic EQ', cat: 'FLT', ...S.eq() },
    { name: 'Para EQ', cat: 'FLT', ...S.peq() },
    { name: 'Green Scream', cat: 'DRV', ...S.drv(voc.ts, []), params: [P('GAIN', 'gain', 0.45), P('TONE', 'tone', 0.5), P('LEVEL', 'level', 0.55)] },
    { name: 'Gold Centaur', cat: 'DRV', ...S.drv(voc.klon), params: [P('GAIN', 'gain', 0.3), P('TREBLE', 'tone', 0.55), P('LEVEL', 'level', 0.55)] },
    { name: 'Rodent Dist', cat: 'DRV', ...S.drv(voc.rat), params: [P('DIST', 'gain', 0.5), P('FILTER', 'tone', 0.45), P('LEVEL', 'level', 0.45)] },
    { name: 'Muffle Fuzz', cat: 'DRV', ...S.drv(voc.muff), params: [P('SUSTAIN', 'gain', 0.55), P('TONE', 'tone', 0.5), P('LEVEL', 'level', 0.45)] },
    { name: 'Smile Fuzz', cat: 'DRV', ...S.drv(voc.fface), params: [P('FUZZ', 'gain', 0.6), P('TONE', 'tone', 0.6), P('LEVEL', 'level', 0.45)] },
    { name: 'SuperDrive', cat: 'DRV', ...S.drv(voc.sd) },
    { name: 'Clean Boost', cat: 'DRV', ...S.drv(voc.boost), params: [P('BOOST', 'gain', 0.4), P('TONE', 'tone', 0.5), P('LEVEL', 'level', 0.5)] },
    { name: 'Metal Wall', cat: 'DRV', ...S.drv(voc.metal), params: [P('GAIN', 'gain', 0.6), P('LOW', 'bass', 0.6), P('MID', 'mid', 0.4), P('HIGH', 'treble', 0.6), P('LEVEL', 'level', 0.4)] },
    amp('US Blues', 'deluxe', '1x12us', { gain: 0.45 }),
    amp('US Twin', 'twin', '2x12twin', { gain: 0.3 }),
    amp('UK 30 Chime', 'ac30', '2x12blue', { gain: 0.45 }),
    amp('JC Clean', 'jc120', '2x12jc', { gain: 0.3 }),
    amp('UK Plexi', 'plexi', '4x12gb', { gain: 0.55 }),
    amp('UK 800', 'jcm800', '4x12gb', { gain: 0.55 }),
    amp('UK Silver', 'jubilee', '4x12v30', { gain: 0.6 }),
    amp('Brown Mod', 'friedman', '4x12v30', { gain: 0.6 }),
    amp('Dual Fire', 'recto', '4x12v30', { gain: 0.6 }),
    amp('Hi-Gain 51', '5150', '4x12t75', { gain: 0.55 }),
    amp('MK Lead', 'markiic', '4x12uber', { gain: 0.55 }),
    amp('Smooth ODS', 'dumble', '1x12us', { gain: 0.45 }),
    { name: 'Chorus', cat: 'MOD', ...S.chorus(0) },
    { name: 'Ensemble', cat: 'MOD', ...S.chorus(2, { mix: 0.45 }) },
    { name: 'Dim Space', cat: 'MOD', ...S.chorus(3, { rate: 0.2, mix: 0.5 }) },
    { name: 'Vibrato', cat: 'MOD', ...S.chorus(1, { mix: 1 }) },
    { name: 'Flanger', cat: 'MOD', ...S.flanger(0) },
    { name: 'Jet Flanger', cat: 'MOD', ...S.flanger(3) },
    { name: 'Phaser', cat: 'MOD', ...S.phaser(4) },
    { name: 'Phase 10', cat: 'MOD', ...S.phaser(10) },
    { name: 'Tremolo', cat: 'MOD', ...S.trem(0) },
    { name: 'Harmonic Trm', cat: 'MOD', ...S.trem(1) },
    { name: 'Uni Vibe', cat: 'MOD', ...S.vibe() },
    { name: 'Rotary', cat: 'MOD', ...S.rotary() },
    { name: 'Octave', cat: 'SFX', ...S.pitch(1 / 7, { mix: 0.6 }) },
    { name: 'Pitch Shift', cat: 'SFX', ...S.pitch(6 / 7, { mix: 0.4 }) },
    { name: 'Ring Mod', cat: 'SFX', ...S.ring() },
    { name: 'Bit Crush', cat: 'SFX', ...S.crusher() },
    { name: 'Delay', cat: 'DLY', ...S.dly(0) },
    { name: 'Analog Dly', cat: 'DLY', ...S.dly(1, [P('TONE', 'tone', 0.4)]) },
    { name: 'Tape Echo', cat: 'DLY', ...S.dly(2, [P('WOW', 'moddepth', 0.25), P('AGE', 'age', 0.35)]) },
    { name: 'Mod Delay', cat: 'DLY', ...S.dly(4, [P('RATE', 'modrate', 0.3), P('DEPTH', 'moddepth', 0.4)]) },
    { name: 'Reverse Dly', cat: 'DLY', ...S.dly(5) },
    { name: 'PingPong', cat: 'DLY', ...S.dly(7, [P('SPREAD', 'spread', 0.8)]) },
    { name: 'Lo-Fi Dly', cat: 'DLY', ...S.dly(3, [P('AGE', 'age', 0.5)]) },
    { name: 'Room', cat: 'REV', ...S.rev(0) },
    { name: 'Hall', cat: 'REV', ...S.rev(1) },
    { name: 'Plate', cat: 'REV', ...S.rev(2) },
    { name: 'Spring', cat: 'REV', ...S.rev(3) },
    { name: 'Shimmer', cat: 'REV', ...S.rev(4, [P('SHIMMER', 'shimmer', 0.5)]) },
    { name: 'Cloud', cat: 'REV', ...S.rev(5) },
    { name: 'Mod Verb', cat: 'REV', ...S.rev(6, [P('MOD', 'mod', 0.5)]) },
    { name: 'Pedal Wah', cat: 'PDL', pedal: 'wah', ...S.wah(0) },
    { name: 'Volume', cat: 'PDL', pedal: 'vol', ...S.vol() },
  ];
  // the compact unit has the same library minus the floor-only extras
  const MS_SKIP = new Set(['Pedal Wah', 'Volume', 'Smooth ODS', 'MK Lead', 'Para EQ']);
  const clone = (list) => list.map((m) => Object.assign({}, m, { fixed: Object.assign({}, m.fixed), params: m.params.slice() }));

  // ---------------------------------------------------------------- unit: ZX-6 (G6-style)
  const g6 = kit.unit({
    id: 'zoom.zx6', slots: 8, knobs: 4, cats: CATS, models: clone(LIB), exp: true, memPrefix: 'PATCH',
    lanes: stdLanes({ drv: 2, dly: 2, cabList: CABS, keep: ['cab'], looper: 60 }),
    patch: [
      ['Noise Gate', true, { THRESH: 0.25 }], ['Gold Centaur', true], ['UK Plexi', true, { GAIN: 0.6 }], ['Chorus', false],
      ['Analog Dly', true, { MIX: 0.22 }], ['Hall', true, { MIX: 0.22 }], ['Pedal Wah', false], null,
    ],
    mems: [
      { name: 'CRUNCH PLEXI' },
      { name: 'GLASS CLEAN', patch: [['Rack Comp', true], null, ['US Twin', true], ['Chorus', true, { MIX: 0.4 }], ['Delay', true, { MIX: 0.2 }], ['Plate', true, { MIX: 0.3 }], ['Pedal Wah', false], null] },
      { name: 'HI-GAIN LEAD', patch: [['Noise Gate', true, { THRESH: 0.4 }], ['Green Scream', true, { GAIN: 0.2, LEVEL: 0.7 }], ['Hi-Gain 51', true, { GAIN: 0.6 }], ['Phaser', false], ['Delay', true, { MIX: 0.25, TIME: 0.6 }], ['Room', true, { MIX: 0.18 }], ['Pedal Wah', false], null] },
      { name: 'AMBIENT SWELL', patch: [['OptoSqueeze', true], null, ['UK 30 Chime', true, { GAIN: 0.35 }], ['Dim Space', true], ['Mod Delay', true, { MIX: 0.35, 'F.B': 0.5 }], ['Shimmer', true, { MIX: 0.45, DECAY: 0.75 }], ['Volume', true], null] },
    ],
  });
  const ms = kit.unit({
    id: 'zoom.ss50', slots: 6, knobs: 4, cats: CATS.filter((c) => c.key !== 'PDL'), models: clone(LIB.filter((m) => !MS_SKIP.has(m.name))), memPrefix: 'PATCH',
    lanes: stdLanes({ drv: 2, dly: 1, cabList: CABS, keep: ['cab'] }),
    patch: [['Rack Comp', true, { SUSTAIN: 0.4 }], ['SuperDrive', true, { GAIN: 0.4 }], ['UK 800', true, { GAIN: 0.5 }], ['Chorus', false], ['Delay', true, { MIX: 0.2 }], ['Spring', true, { MIX: 0.25 }]],
    mems: [
      { name: 'BRIT CRUNCH' },
      { name: 'CLEAN CHORUS', patch: [['Rack Comp', true], null, ['JC Clean', true], ['Chorus', true, { MIX: 0.45 }], ['Delay', true, { MIX: 0.18 }], ['Hall', true, { MIX: 0.3 }]] },
      { name: 'FUZZ VIBE', patch: [null, ['Muffle Fuzz', true], ['US Blues', true, { GAIN: 0.4 }], ['Uni Vibe', true], ['Tape Echo', true, { MIX: 0.22 }], ['Room', true, { MIX: 0.2 }]] },
      { name: 'METAL', patch: [['Noise Gate', true, { THRESH: 0.45 }], ['Green Scream', true, { GAIN: 0.15, LEVEL: 0.7 }], ['Dual Fire', true], null, ['Delay', false], ['Room', true, { MIX: 0.12 }]] },
    ],
  });

  const ZFONT = "'Barlow Condensed', 'Arial Narrow', sans-serif";
  const ZSANS = "'Inter', 'Helvetica', sans-serif";
  const MSMONO = "'Share Tech Mono', 'DejaVu Sans Mono', monospace";
  const hit = (pt, x, y, w, h) => pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h;
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '.' : s);
  const blkOf = (view) => view.block;

  // ================================================================= ZX-6 touchscreen
  const G6 = { bg: '#000000', bar: '#0b1218', acc: '#18c3ff', dim: '#5c6878', tile: '#11161d', edge: '#2a3442' };
  tz.addScreen('zx6-touch', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      R(g, 0, 0, w, h, { fill: G6.bg });
      // ---- top bar (tap = MENU)
      R(g, 0, 0, w, 12, { fill: G6.bar });
      s.tbMode = T(g, 4, 6.3, '', { anchor: 'start', size: 5.4, fill: G6.acc, font: ZFONT, weight: 700, ls: 0.4 });
      s.tbName = T(g, 44, 6.3, '', { anchor: 'start', size: 7, fill: '#fff', font: ZFONT, weight: 700, ls: 0.3 });
      s.tbBpm = T(g, w - 4, 6.3, '', { anchor: 'end', size: 5.6, fill: '#c9d4e3', font: ZSANS, weight: 600 });
      R(g, w / 2 - 8, 10.4, 16, 1.2, { rx: 0.6, fill: '#3b4a5c' }); // pull-down handle
      // ---- views
      const V = (name) => (s[name] = svg('g', {}, g));
      // HOME: effect board, 8 pedals in 2 rows
      V('vHome');
      s.tiles = [];
      const tw = (w - 10) / 4, th = Math.floor((h - 34) / 2);
      for (let i = 0; i < 8; i++) {
        const x = 3 + (i % 4) * (tw + 1.3), y = 15 + Math.floor(i / 4) * (th + 3);
        const t = svg('g', { transform: `translate(${x},${y})` }, s.vHome);
        const body = R(t, 0, 0, tw - 1, th, { rx: 3, fill: G6.tile, stroke: G6.edge, 'stroke-width': 0.6 });
        const band = R(t, 0, 0, tw - 1, 7, { rx: 3, fill: '#333' });
        R(t, 0, 4, tw - 1, 3, { fill: '#000', 'fill-opacity': 0.25 });
        const cat = T(t, 3, 3.8, '', { anchor: 'start', size: 3.8, fill: '#000', font: ZSANS, weight: 800, ls: 0.3 });
        const num = T(t, tw - 4, 3.8, String(i + 1), { anchor: 'end', size: 3.8, fill: '#000', font: ZSANS, weight: 800 });
        const name = T(t, (tw - 1) / 2, 17, '', { size: 6.6, fill: '#fff', font: ZFONT, weight: 700 });
        const sub = T(t, (tw - 1) / 2, 24.5, '', { size: 3.9, fill: G6.dim, font: ZSANS, weight: 600 });
        const led = svg('circle', { cx: tw - 6, cy: th - 5, r: 2.2, fill: '#300' }, t);
        const plus = T(t, (tw - 1) / 2, th / 2 + 1, '+', { size: 13, fill: '#2a3442', font: ZSANS, weight: 300 });
        s.tiles.push({ x, y, w: tw - 1, h: th, body, band, cat, num, name, sub, led, plus });
      }
      // knob strip: what knobs 1-4 do for the selected effect
      R(s.vHome, 0, h - 14, w, 14, { fill: '#05080b' });
      s.strip = [0, 1, 2, 3].map((k) => {
        const x = 3 + k * ((w - 6) / 4);
        R(s.vHome, x, h - 13, (w - 6) / 4 - 1.5, 12, { rx: 2, fill: '#0d141c' });
        return { l: T(s.vHome, x + 3, h - 9.5, '', { anchor: 'start', size: 3.7, fill: G6.dim, font: ZSANS, weight: 700 }), v: T(s.vHome, x + 3, h - 4.5, '', { anchor: 'start', size: 5.4, fill: '#fff', font: ZFONT, weight: 700 }) };
      });
      s.pageTxt = T(s.vHome, w - 5, h - 9.5, '', { anchor: 'end', size: 3.7, fill: G6.acc, font: ZSANS, weight: 700 });

      // EDIT: one effect, 4 dials per page
      V('vEdit');
      R(s.vEdit, 0, 12, w, 15, { fill: '#070b10' });
      s.eBack = T(s.vEdit, 7, 19.5, '‹', { size: 12, fill: G6.acc, font: ZSANS, weight: 400 });
      s.eBand = R(s.vEdit, 15, 15, 2.4, 9, { rx: 1, fill: '#fff' });
      s.eName = T(s.vEdit, 21, 18, '', { anchor: 'start', size: 8.4, fill: '#fff', font: ZFONT, weight: 700 });
      s.eCat = T(s.vEdit, 21, 24.4, '', { anchor: 'start', size: 3.8, fill: G6.dim, font: ZSANS, weight: 700, ls: 0.5 });
      s.eChg = T(s.vEdit, 112, 19.5, 'CHANGE ▸', { size: 4.6, fill: G6.acc, font: ZSANS, weight: 700 });
      s.eOnBg = R(s.vEdit, w - 30, 15, 26, 9, { rx: 4.5, fill: '#1c2a38' });
      s.eOn = T(s.vEdit, w - 17, 19.6, 'ON', { size: 5, fill: '#fff', font: ZSANS, weight: 800 });
      s.dials = [0, 1, 2, 3].map((k) => {
        const cx = w * (k + 0.5) / 4, cy = 62, r = 17;
        const arc = (a0, a1) => { const p = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
        svg('path', { d: arc(-2.4, 2.4), fill: 'none', stroke: '#1d2733', 'stroke-width': 3.4, 'stroke-linecap': 'round' }, s.vEdit);
        const val = svg('path', { d: '', fill: 'none', stroke: G6.acc, 'stroke-width': 3.4, 'stroke-linecap': 'round' }, s.vEdit);
        const cap = svg('circle', { cx, cy, r: r - 5, fill: '#121a24', stroke: '#26323f', 'stroke-width': 0.6 }, s.vEdit);
        const ptr = svg('line', { x1: cx, y1: cy, x2: cx, y2: cy - r + 6, stroke: '#fff', 'stroke-width': 1.1, 'stroke-linecap': 'round' }, s.vEdit);
        const lab = T(s.vEdit, cx, cy + r + 6, '', { size: 4.6, fill: G6.dim, font: ZSANS, weight: 700, ls: 0.3 });
        const v = T(s.vEdit, cx, cy + r + 13, '', { size: 7, fill: '#fff', font: ZFONT, weight: 700 });
        return { cx, cy, r, val, cap, ptr, lab, v, arc, last: '' };
      });
      s.ePrev = T(s.vEdit, 5, 62, '◂', { size: 8, fill: G6.acc, font: ZSANS });
      s.eNext = T(s.vEdit, w - 5, 62, '▸', { size: 8, fill: G6.acc, font: ZSANS });
      s.eDots = [0, 1, 2].map((i) => svg('circle', { cx: w / 2 - 6 + i * 6, cy: h - 4, r: 1.4, fill: '#2a3442' }, s.vEdit));

      // BROWSE: categories | models
      V('vBrowse');
      R(s.vBrowse, 0, 12, w, 10, { fill: '#070b10' });
      s.bTitle = T(s.vBrowse, 5, 17, '', { anchor: 'start', size: 5, fill: '#c9d4e3', font: ZSANS, weight: 700, ls: 0.4 });
      s.bBack = T(s.vBrowse, w - 5, 17, 'BACK', { anchor: 'end', size: 5, fill: G6.acc, font: ZSANS, weight: 800 });
      s.cats = CATS.map((c, i) => {
        const y = 23 + i * 9.8;
        const bg = R(s.vBrowse, 2, y, 54, 9, { rx: 2, fill: '#0b1118' });
        R(s.vBrowse, 4, y + 2.5, 3, 4, { rx: 1, fill: c.color });
        const t = T(s.vBrowse, 10, y + 4.7, c.name, { anchor: 'start', size: 4.6, fill: '#aab5c4', font: ZSANS, weight: 700, ls: 0.2 });
        return { y, bg, t, key: c.key };
      });
      s.rows = [];
      for (let r = 0; r < 8; r++) {
        const y = 23 + r * 10.9;
        const bg = R(s.vBrowse, 59, y, w - 69, 10, { rx: 2, fill: '#0b1118' });
        const t = T(s.vBrowse, 63, y + 5.2, '', { anchor: 'start', size: 6.4, fill: '#fff', font: ZFONT, weight: 700 });
        const tag = T(s.vBrowse, w - 13, y + 5.2, '', { anchor: 'end', size: 3.8, fill: G6.acc, font: ZSANS, weight: 800 });
        s.rows.push({ y, bg, t, tag });
      }
      s.sbar = R(s.vBrowse, w - 7, 23, 3, 20, { rx: 1.5, fill: '#2a3442' });
      s.bDel = T(s.vBrowse, 29, h - 4, '', { size: 4.4, fill: '#ff6b6b', font: ZSANS, weight: 800 });

      // PATCH: big memory name
      V('vPatch');
      s.pNum = T(s.vPatch, w / 2, 32, '', { size: 11, fill: G6.acc, font: ZFONT, weight: 700, ls: 1 });
      s.pName = T(s.vPatch, w / 2, 54, '', { size: 18, fill: '#fff', font: ZFONT, weight: 800, ls: 0.6 });
      s.pChain = T(s.vPatch, w / 2, 72, '', { size: 4.6, fill: G6.dim, font: ZSANS, weight: 600 });
      s.pUp = T(s.vPatch, w - 12, 42, '▲', { size: 8, fill: '#2a3442', font: ZSANS });
      s.pDn = T(s.vPatch, w - 12, 66, '▼', { size: 8, fill: '#2a3442', font: ZSANS });
      T(s.vPatch, w / 2, h - 8, 'SWIPE / ▲▼ TO CHANGE PATCH', { size: 4, fill: '#3b4a5c', font: ZSANS, weight: 700, ls: 0.6 });

      // MEMORY: bank of 4
      V('vMem');
      s.mBank = T(s.vMem, 6, 18, '', { anchor: 'start', size: 5, fill: '#c9d4e3', font: ZSANS, weight: 800, ls: 0.5 });
      s.mStore = R(s.vMem, w - 40, 13.5, 36, 9, { rx: 4.5, fill: '#1c2a38' });
      s.mStoreT = T(s.vMem, w - 22, 18.2, 'STORE', { size: 4.8, fill: '#fff', font: ZSANS, weight: 800 });
      s.mTiles = [0, 1, 2, 3].map((i) => {
        const x = 4 + (i % 2) * ((w - 8) / 2), y = 25 + Math.floor(i / 2) * 42;
        const bg = R(s.vMem, x, y, (w - 8) / 2 - 3, 39, { rx: 3, fill: G6.tile, stroke: G6.edge, 'stroke-width': 0.6 });
        const n = T(s.vMem, x + 5, y + 7, '', { anchor: 'start', size: 5, fill: G6.acc, font: ZSANS, weight: 800 });
        const t = T(s.vMem, x + ((w - 8) / 2 - 3) / 2, y + 22, '', { size: 8.2, fill: '#fff', font: ZFONT, weight: 700 });
        return { x, y, w: (w - 8) / 2 - 3, h: 39, bg, n, t };
      });

      // LOOPER
      V('vLoop');
      s.lState = T(s.vLoop, w / 2, 32, '', { size: 16, fill: '#fff', font: ZFONT, weight: 800, ls: 1 });
      s.lLen = T(s.vLoop, w / 2, 47, '', { size: 6, fill: G6.dim, font: ZSANS, weight: 600 });
      R(s.vLoop, 12, 54, w - 24, 5, { rx: 2.5, fill: '#16202b' });
      s.lBar = R(s.vLoop, 12, 54, 0, 5, { rx: 2.5, fill: '#42e07a' });
      s.lBtns = ['REC/PLAY', 'STOP', 'UNDO', 'CLEAR'].map((t, i) => {
        const bw = (w - 16) / 4, x = 6 + i * (bw + 1.3);
        const bg = R(s.vLoop, x, 68, bw - 1, 22, { rx: 3, fill: '#101820', stroke: G6.edge, 'stroke-width': 0.6 });
        T(s.vLoop, x + (bw - 1) / 2, 79, t, { size: 5, fill: '#e6edf6', font: ZSANS, weight: 800 });
        return { x, y: 68, w: bw - 1, h: 22, bg };
      });
      T(s.vLoop, w / 2, h - 6, 'FOOTSWITCHES 1-4 = REC/PLAY · STOP · UNDO · CLEAR', { size: 3.8, fill: '#3b4a5c', font: ZSANS, weight: 700 });

      // MENU (pulled down from the top bar) and its sub-pages
      V('vMenu');
      R(s.vMenu, 0, 12, w, h - 12, { fill: '#05090d' });
      s.mItems = ['EFFECT BOARD', 'MEMORY', 'LOOPER', 'TEMPO', 'EXP PEDAL', 'OUTPUT'].map((t, i) => {
        const bw = (w - 12) / 3, x = 4 + (i % 3) * (bw + 2), y = 17 + Math.floor(i / 3) * 44;
        const bg = R(s.vMenu, x, y, bw, 40, { rx: 4, fill: '#0f1821', stroke: G6.edge, 'stroke-width': 0.6 });
        const ic = svg('g', { transform: `translate(${x + bw / 2},${y + 16})` }, s.vMenu);
        menuIcon(ic, i);
        const tt = T(s.vMenu, x + bw / 2, y + 33, t, { size: 4.8, fill: '#dbe5f1', font: ZSANS, weight: 800, ls: 0.3 });
        return { x, y, w: bw, h: 40, bg, tt };
      });
      V('vSub');
      R(s.vSub, 0, 12, w, h - 12, { fill: '#05090d' });
      R(s.vSub, 0, 12, w, 11, { fill: '#0b1218' });
      s.sTitle = T(s.vSub, 6, 17.5, '', { anchor: 'start', size: 5.4, fill: '#fff', font: ZSANS, weight: 800, ls: 0.6 });
      s.sBack = T(s.vSub, w - 6, 17.5, 'DONE', { anchor: 'end', size: 5, fill: G6.acc, font: ZSANS, weight: 800 });
      s.sBig = T(s.vSub, w / 2, 52, '', { size: 22, fill: '#fff', font: ZFONT, weight: 800 });
      s.sMinus = R(s.vSub, 14, 40, 26, 22, { rx: 4, fill: '#122030' });
      T(s.vSub, 27, 51, '-', { size: 14, fill: '#fff', font: ZSANS });
      s.sPlus = R(s.vSub, w - 40, 40, 26, 22, { rx: 4, fill: '#122030' });
      T(s.vSub, w - 27, 51, '+', { size: 13, fill: '#fff', font: ZSANS });
      s.sTap = R(s.vSub, w / 2 - 20, 74, 40, 14, { rx: 7, fill: '#18c3ff' });
      s.sTapT = T(s.vSub, w / 2, 81.2, 'TAP', { size: 6, fill: '#00151f', font: ZSANS, weight: 800 });
      s.sOpts = ['AUTO', 'VOLUME', 'WAH', 'OFF'].map((t, i) => {
        const y = 28 + i * 18;
        const bg = R(s.vSub, 20, y, w - 40, 15, { rx: 3, fill: '#0f1821' });
        const tt = T(s.vSub, 30, y + 7.6, t, { anchor: 'start', size: 7, fill: '#fff', font: ZFONT, weight: 700 });
        const ck = T(s.vSub, w - 30, y + 7.6, '', { anchor: 'end', size: 7, fill: G6.acc, font: ZSANS, weight: 800 });
        return { y, bg, tt, ck };
      });
      s.sHint = T(s.vSub, w / 2, h - 6, '', { size: 4, fill: '#3b4a5c', font: ZSANS, weight: 700 });
      s.views = ['vHome', 'vEdit', 'vBrowse', 'vPatch', 'vMem', 'vLoop', 'vMenu', 'vSub'];
      s.sig = '';
    },
    update(s, status, view, now) {
      const blk = blkOf(view), ui = s.ui, n = nav(blk.id), w = s.w, h = s.h;
      const Al = g6.alloc(ui);
      const fsm = ui._fsm ?? 2;
      const vname = { home: 'vHome', edit: 'vEdit', browse: 'vBrowse', patch: 'vPatch', mem: 'vMem', loop: 'vLoop', menu: 'vMenu', tempo: 'vSub', exp: 'vSub', out: 'vSub' }[n.view] || 'vHome';
      if (s.curView !== vname) {
        for (const k of s.views) sa(s[k], 'display', k === vname ? 'inline' : 'none');
        s.curView = vname;
      }
      // top bar
      const cur = ui._cur | 0;
      st(s.tbMode, ['PATCH', 'MEMORY', 'BOARD', 'LOOPER'][fsm]);
      st(s.tbName, `${String(cur + 1).padStart(2, '0')} ${A.memName(blk, cur)}`);
      const beat = (now / (60000 / (ui._bpm || 120))) % 1 < 0.15;
      st(s.tbBpm, `♩${ui._bpm || 120}`);
      sa(s.tbBpm, 'fill', beat ? G6.acc : '#c9d4e3');
      if (n.view === 'loop') {
        const tr = status?.lpr?.looper?.tracks?.[0];
        const stt = tr ? tr.state : 0;
        st(s.lState, ['READY', 'REC', 'PLAY', 'OVERDUB', 'STOP'][stt] || 'READY');
        sa(s.lState, 'fill', ['#e6edf6', '#ff4040', '#42e07a', '#ffd23a', '#e6edf6'][stt]);
        st(s.lLen, tr && tr.len ? (tr.len || 0).toFixed(1) + ' s' : '- s');
        sa(s.lBar, 'width', ((tr ? (stt === 1 ? (now % 2000) / 2000 : tr.pos || 0) : 0) * (w - 24)).toFixed(1));
      }
      // everything else only when something changed
      let sig = `${n.view}|${n.t}|${n.sel}|${n.page}|${fsm}|${cur}|${n.cat}|${n.top}|${ui._expT}|${ui._lvl}|${ui._bpm}|${n.storeArm ? 1 : 0}|${n.memBank | 0}`;
      for (let i = 0; i < 8; i++) sig += `|${ui['_m' + i]}${ui['_o' + i]}`;
      for (let k = 0; k < 8; k++) sig += `|${(ui[`_p${n.sel}_${k}`] ?? 0).toFixed(3)}`;
      if (sig === s.sig) return;
      s.sig = sig;
      const slot = (i) => g6.slot(ui, i, Al);
      if (n.view === 'home') {
        s.tiles.forEach((t, i) => {
          const x = slot(i);
          const sel = n.sel === i;
          sa(t.body, 'stroke', sel ? '#ffffff' : G6.edge);
          sa(t.body, 'stroke-width', sel ? 1.2 : 0.6);
          if (!x.m) {
            sa(t.band, 'fill', '#1a222c'); st(t.cat, ''); st(t.name, ''); st(t.sub, ''); sa(t.led, 'fill', 'none'); sa(t.plus, 'fill', sel ? '#5c6878' : '#2a3442');
            sa(t.num, 'fill', '#5c6878');
            return;
          }
          sa(t.plus, 'fill', 'none');
          sa(t.band, 'fill', x.cat.color);
          sa(t.num, 'fill', '#000');
          st(t.cat, x.cat.key);
          st(t.name, short(x.m.name, 12));
          st(t.sub, x.over ? 'DSP FULL' : x.on ? 'ON' : 'OFF');
          sa(t.sub, 'fill', x.over ? '#ff5050' : x.on ? '#9fb0c3' : G6.dim);
          sa(t.led, 'fill', x.over ? '#ff5050' : x.on ? x.cat.color : '#1d232b');
        });
        const x = slot(n.sel);
        const pg = n.page;
        s.strip.forEach((c, k) => {
          const p = x.m && x.m.params[pg * 4 + k];
          st(c.l, p ? p.label : '');
          st(c.v, p ? fmt(p, x.val(pg * 4 + k)) : '');
        });
        st(s.pageTxt, x.m ? `${x.m.name.toUpperCase()} · P${pg + 1}/${A.pages(blk)}` : `SLOT ${n.sel + 1} EMPTY · TAP TO ADD`);
      } else if (n.view === 'edit') {
        const x = slot(n.sel);
        if (!x.m) { A.view(blk, 'browse'); return; }
        st(s.eName, x.m.name);
        st(s.eCat, `${x.cat.name} · SLOT ${n.sel + 1}${x.over ? ' · DSP FULL' : ''}`);
        sa(s.eBand, 'fill', x.cat.color);
        sa(s.eOnBg, 'fill', x.on ? x.cat.color : '#1c2a38');
        st(s.eOn, x.on ? 'ON' : 'OFF');
        sa(s.eOn, 'fill', x.on ? '#000' : '#8a97a8');
        const np = A.pages(blk);
        s.dials.forEach((d, k) => {
          const pi = n.page * 4 + k, p = x.m.params[pi];
          if (!p) { sa(d.val, 'd', ''); st(d.lab, ''); st(d.v, ''); sa(d.cap, 'fill-opacity', 0.2); sa(d.ptr, 'stroke-opacity', 0); return; }
          const v = x.val(pi);
          const a = -2.4 + 4.8 * v;
          sa(d.val, 'd', v > 0.005 ? d.arc(-2.4, a) : '');
          sa(d.val, 'stroke', x.cat.color);
          sa(d.cap, 'fill-opacity', 1);
          sa(d.ptr, 'stroke-opacity', 1);
          sa(d.ptr, 'x2', (d.cx + (d.r - 6) * Math.sin(a)).toFixed(2));
          sa(d.ptr, 'y2', (d.cy - (d.r - 6) * Math.cos(a)).toFixed(2));
          st(d.lab, p.label);
          st(d.v, fmt(p, v));
        });
        s.eDots.forEach((d, i) => { sa(d, 'fill', i < np ? (i === n.page ? G6.acc : '#2a3442') : 'none'); });
        sa(s.ePrev, 'fill', np > 1 ? G6.acc : 'none');
        sa(s.eNext, 'fill', np > 1 ? G6.acc : 'none');
      } else if (n.view === 'browse') {
        const cat = CATS[n.cat] || CATS[0];
        const x = slot(n.sel);
        st(s.bTitle, `SLOT ${n.sel + 1} · SELECT EFFECT`);
        s.cats.forEach((c, i) => { sa(c.bg, 'fill', i === n.cat ? '#16314a' : '#0b1118'); sa(c.t, 'fill', i === n.cat ? '#fff' : '#8794a6'); });
        const list = g6.inCat(cat.key);
        s.rows.forEach((r, i) => {
          const m = list[n.top + i];
          const cur2 = m && x.m && m.idx === x.m.idx;
          st(r.t, m ? m.name : '');
          st(r.tag, cur2 ? 'IN USE' : '');
          sa(r.bg, 'fill', m ? (cur2 ? '#16314a' : '#0b1118') : 'none');
          sa(r.bg, 'stroke', cur2 ? cat.color : 'none');
        });
        const tot = Math.max(1, list.length);
        sa(s.sbar, 'height', (Math.min(1, 8 / tot) * 87).toFixed(1));
        sa(s.sbar, 'y', (23 + (n.top / tot) * 87).toFixed(1));
        sa(s.sbar, 'fill', tot > 8 ? '#3b4a5c' : 'none');
        st(s.bDel, x.m ? 'REMOVE' : '');
      } else if (n.view === 'patch') {
        st(s.pNum, `PATCH ${String(cur + 1).padStart(2, '0')}`);
        st(s.pName, A.memName(blk, cur));
        const names = [];
        for (let i = 0; i < 8; i++) { const x = slot(i); if (x.m && x.on) names.push(x.m.name); }
        st(s.pChain, names.join(' › ') || 'empty');
        sa(s.pUp, 'fill', G6.acc); sa(s.pDn, 'fill', G6.acc);
      } else if (n.view === 'mem') {
        const bank = n.memBank | 0;
        st(s.mBank, `BANK ${String.fromCharCode(65 + bank)}${n.storeArm ? ' · TOUCH A MEMORY TO STORE' : ''}`);
        sa(s.mStore, 'fill', n.storeArm ? '#ff4040' : '#1c2a38');
        s.mTiles.forEach((t, i) => {
          const m = bank * 4 + i;
          st(t.n, String(m + 1).padStart(2, '0'));
          st(t.t, short(A.memName(blk, m), 14));
          sa(t.bg, 'stroke', m === cur ? G6.acc : G6.edge);
          sa(t.bg, 'stroke-width', m === cur ? 1.4 : 0.6);
          sa(t.bg, 'fill', m === cur ? '#0f2333' : G6.tile);
        });
      } else if (n.view === 'menu') {
        s.mItems.forEach((it, i) => sa(it.bg, 'stroke', i === (n.menu | 0) ? G6.acc : G6.edge));
      } else {
        const sub = n.view;
        st(s.sTitle, { tempo: 'TEMPO', exp: 'EXPRESSION PEDAL', out: 'OUTPUT LEVEL' }[sub]);
        const num = sub !== 'exp';
        for (const el of [s.sMinus, s.sPlus]) sa(el, 'fill', num ? '#122030' : 'none');
        sa(s.sTap, 'fill', sub === 'tempo' ? G6.acc : 'none');
        st(s.sTapT, sub === 'tempo' ? 'TAP' : '');
        st(s.sBig, sub === 'tempo' ? `${ui._bpm || 120} BPM` : sub === 'out' ? `${(ui._lvl ?? 0) > 0 ? '+' : ''}${(ui._lvl ?? 0).toFixed(1)} dB` : '');
        s.sOpts.forEach((o, i) => {
          const on = sub === 'exp';
          sa(o.bg, 'fill', on ? ((ui._expT ?? 0) === i ? '#16314a' : '#0f1821') : 'none');
          st(o.tt, on ? ['AUTO (WAH › VOLUME)', 'VOLUME', 'WAH', 'OFF'][i] : '');
          st(o.ck, on && (ui._expT ?? 0) === i ? '✓' : '');
        });
        st(s.sHint, sub === 'tempo' ? 'DELAY TIMES FOLLOW THE TEMPO' : sub === 'out' ? 'MASTER OUTPUT OF THE UNIT' : 'WHAT THE BUILT-IN PEDAL CONTROLS');
      }
    },
    pointer(s, view, type, pt, e, editor) {
      const blk = blkOf(view), n = nav(blk.id), ui = tz.app.ui(blk), w = s.w, h = s.h;
      if (type === 'wheel') {
        const d = e.deltaY > 0 ? 1 : -1;
        if (n.view === 'home') A.selMove(blk, d);
        else if (n.view === 'edit') { const k = s.dials.findIndex((q) => Math.abs(pt.x - q.cx) < 24); if (k >= 0) A.nudge(blk, n.sel, n.page * 4 + k, -d); }
        else if (n.view === 'browse') { const list = g6.inCat(CATS[n.cat].key); n.top = Math.max(0, Math.min(Math.max(0, list.length - 8), n.top + d)); kit.bump(blk); }
        else if (n.view === 'patch') A.recall(blk, ((ui._cur | 0) + d + 12) % 12);
        return;
      }
      if (type === 'move' && s.drag) {
        const dv = (s.drag.y0 - pt.y) / 60 * (e.shiftKey ? 0.25 : 1);
        A.setVal(blk, n.sel, s.drag.k, s.drag.v0 + dv);
        const p = g6.slot(ui, n.sel).m?.params[s.drag.k];
        if (p) editor.tipText(e, `${p.label} ${fmt(p, tz.app.ui(blk)[`_p${n.sel}_${s.drag.k}`])}`);
        return;
      }
      if (type === 'up') { s.drag = null; editor.hideTip(); return; }
      if (type !== 'down') return;
      s.sig = '';
      // top bar = menu (pull down)
      if (pt.y < 12) { A.view(blk, n.view === 'menu' ? 'home' : 'menu'); return; }
      switch (n.view) {
        case 'home': {
          const i = s.tiles.findIndex((t) => hit(pt, t.x, t.y, t.w, t.h));
          if (i < 0) return;
          const t = s.tiles[i];
          const x = g6.slot(ui, i);
          if (x.m && hit(pt, t.x + t.w - 11, t.y + t.h - 11, 11, 11)) { A.toggle(blk, i); return; } // the LED corner toggles
          if (n.sel === i) { A.view(blk, x.m ? 'edit' : 'browse'); if (!x.m) n.cat = 0; }
          else A.select(blk, i);
          return;
        }
        case 'edit': {
          if (pt.y < 27) {
            if (pt.x < 16) A.view(blk, 'home');
            else if (pt.x > w - 32) A.toggle(blk, n.sel);
            else { const x = g6.slot(ui, n.sel); n.cat = Math.max(0, CATS.findIndex((c) => c.key === x.m?.cat)); A.view(blk, 'browse'); scrollTo(n, x.m); }
            return;
          }
          if (pt.x < 10) { A.page(blk, -1); return; }
          if (pt.x > w - 10) { A.page(blk, 1); return; }
          const k = s.dials.findIndex((q) => Math.hypot(pt.x - q.cx, pt.y - q.cy) < 22);
          const pi = n.page * 4 + k;
          const x = g6.slot(ui, n.sel);
          if (k >= 0 && x.m && x.m.params[pi]) s.drag = { k: pi, v0: x.val(pi), y0: pt.y };
          return;
        }
        case 'browse': {
          if (pt.y < 22) { if (pt.x > w - 30) A.view(blk, g6.slot(ui, n.sel).m ? 'edit' : 'home'); return; }
          if (pt.x < 57) {
            const c = s.cats.findIndex((q) => pt.y >= q.y && pt.y < q.y + 9.8);
            if (c >= 0) { n.cat = c; n.top = 0; kit.bump(blk); }
            else if (pt.y > h - 9 && g6.slot(ui, n.sel).m) { A.setModel(blk, n.sel, -1); A.view(blk, 'home'); }
            return;
          }
          const r = s.rows.findIndex((q) => pt.y >= q.y && pt.y < q.y + 10.9);
          const m = r >= 0 && g6.inCat(CATS[n.cat].key)[n.top + r];
          if (m) { A.setModel(blk, n.sel, m.idx); A.view(blk, 'edit'); }
          return;
        }
        case 'patch': A.recall(blk, ((ui._cur | 0) + (pt.y < h / 2 ? 1 : -1) + 12) % 12); return;
        case 'mem': {
          if (pt.y < 24) { if (pt.x > w - 42) { n.storeArm = !n.storeArm; kit.bump(blk); } else { n.memBank = ((n.memBank | 0) + 1) % 3; kit.bump(blk); } return; }
          const i = s.mTiles.findIndex((t) => hit(pt, t.x, t.y, t.w, t.h));
          if (i < 0) return;
          const m = (n.memBank | 0) * 4 + i;
          if (n.storeArm) { A.store(blk, m); n.storeArm = false; } else A.recall(blk, m);
          return;
        }
        case 'loop': { const i = s.lBtns.findIndex((b) => hit(pt, b.x, b.y, b.w, b.h)); if (i >= 0) A.loop(blk, [1, 2, 4, 3][i]); return; }
        case 'menu': {
          const i = s.mItems.findIndex((b) => hit(pt, b.x, b.y, b.w, b.h));
          if (i < 0) return;
          n.menu = i;
          if (i < 3) { setMode(blk, [2, 1, 3][i]); return; }
          A.view(blk, ['tempo', 'exp', 'out'][i - 3]);
          return;
        }
        default: {
          if (pt.y < 24) { if (pt.x > w - 30) A.view(blk, 'menu'); return; }
          const sub = n.view;
          if (sub === 'exp') { const i = s.sOpts.findIndex((o) => pt.y >= o.y && pt.y < o.y + 15); if (i >= 0) tz.app.setParam(blk.id, '_expT', i); kit.bump(blk); return; }
          const d = hit(pt, 14, 40, 26, 22) ? -1 : hit(pt, w - 40, 40, 26, 22) ? 1 : 0;
          if (sub === 'tempo') {
            if (d) tz.app.setParam(blk.id, '_bpm', Math.max(40, Math.min(250, (ui._bpm || 120) + d)));
            else if (hit(pt, w / 2 - 20, 74, 40, 14)) A.tap(blk);
            if (d) tempoToDelays(blk);
          } else if (sub === 'out' && d) tz.app.setParam(blk.id, '_lvl', Math.max(-24, Math.min(12, (ui._lvl ?? 0) + d * 0.5)));
          kit.bump(blk);
        }
      }
    },
  });
  function scrollTo(n, m) {
    if (!m) { n.top = 0; return; }
    const list = g6.inCat(m.cat);
    const i = list.indexOf(m);
    n.top = Math.max(0, Math.min(Math.max(0, list.length - 8), i - 3));
  }
  function tempoToDelays(blk) {
    // the -/+ buttons set the tempo: quarter-note delay times follow (like tapping)
    const u = kit.U(blk), ui = tz.app.ui(blk);
    const msq = 60000 / (ui._bpm || 120);
    for (let i = 0; i < u.nSlots; i++) {
      const m = u.models[ui[`_m${i}`] ?? -1];
      if (m) m.params.forEach((p, k) => { if (p.eng === 'time') tz.app.setParam(blk.id, `_p${i}_${k}`, kit.toNorm(p, Math.min(p.max, Math.max(p.min, msq)))); });
    }
  }
  function menuIcon(g, i) {
    const c = '#18c3ff';
    if (i === 0) for (let k = 0; k < 3; k++) R(g, -11 + k * 8, -5, 6, 10, { rx: 1.5, fill: 'none', stroke: c, 'stroke-width': 0.9 });
    else if (i === 1) for (let k = 0; k < 4; k++) R(g, -9 + (k % 2) * 10, -8 + Math.floor(k / 2) * 9, 8, 7, { rx: 1, fill: 'none', stroke: c, 'stroke-width': 0.9 });
    else if (i === 2) { svg('circle', { r: 7, fill: 'none', stroke: c, 'stroke-width': 0.9 }, g); svg('path', { d: 'M7 0 l-2.5 -3 M7 0 l2.5 -3', stroke: c, 'stroke-width': 0.9, fill: 'none' }, g); }
    else if (i === 3) { svg('path', { d: 'M-6 7 L-2 -8 H2 L6 7 Z M0 3 L5 -6', fill: 'none', stroke: c, 'stroke-width': 0.9 }, g); }
    else if (i === 4) { svg('path', { d: 'M-9 6 L8 -6 L9 -3 L-8 8 Z', fill: 'none', stroke: c, 'stroke-width': 0.9 }, g); }
    else { for (let k = 0; k < 5; k++) R(g, -9 + k * 4, 6 - k * 3, 2.6, 2 + k * 3, { fill: c, 'fill-opacity': 0.25 + k * 0.15 }); }
  }
  function setMode(blk, m) {
    tz.app.setParam(blk.id, '_fsm', m);
    A.view(blk, ['patch', 'mem', 'home', 'loop'][m]);
  }

  // ---- the four footswitch displays (one small LCD above each switch)
  tz.addScreen('zx6-fs', {
    build(s, g, w, h) {
      R(g, 0, 0, w, h, { fill: '#000' });
      s.band = R(g, 0, 0, w, 3, { fill: '#333' });
      s.top = T(g, 3, 7.5, '', { anchor: 'start', size: 4, fill: '#6e7b8c', font: ZSANS, weight: 800, ls: 0.3 });
      s.st = T(g, w - 3, 7.5, '', { anchor: 'end', size: 4, fill: '#6e7b8c', font: ZSANS, weight: 800 });
      s.name = T(g, w / 2, h - 7, '', { size: 7.6, fill: '#fff', font: ZFONT, weight: 700 });
      s.sig = '';
    },
    update(s, status, view, now) {
      const blk = view.block, ui = s.ui, n = nav(blk.id), i = s.ctl.idx | 0;
      const fsm = ui._fsm ?? 2;
      let sig = fsm + '|' + n.t + '|' + (ui._cur | 0) + '|' + (n.fsBank | 0) + '|' + (n.memBank | 0);
      let ls = 0;
      if (fsm === 3) { const tr = status?.lpr?.looper?.tracks?.[0]; ls = tr ? tr.state : 0; sig += '|' + ls; }
      else for (let k = 0; k < 8; k++) sig += `|${ui['_m' + k]}${ui['_o' + k]}`;
      if (sig === s.sig) return;
      s.sig = sig;
      if (fsm === 2) {
        const si = (n.fsBank | 0) * 4 + i;
        const x = g6.slot(ui, si, g6.alloc(ui));
        sa(s.band, 'fill', x.m ? x.cat.color : '#222');
        st(s.top, `FX ${si + 1}`);
        st(s.st, x.m ? (x.on ? 'ON' : 'OFF') : '');
        sa(s.st, 'fill', x.on ? x.cat.color : '#6e7b8c');
        st(s.name, x.m ? short(x.m.name, 12) : '-');
        sa(s.name, 'fill', x.m && x.on ? '#fff' : '#6e7b8c');
      } else if (fsm === 3) {
        sa(s.band, 'fill', ['#ff4040', '#e6edf6', '#ffd23a', '#e6edf6'][i]);
        st(s.top, 'LOOPER');
        st(s.st, '');
        st(s.name, ['REC/PLAY', 'STOP', 'UNDO', 'CLEAR'][i]);
        sa(s.name, 'fill', '#fff');
      } else {
        const m = (n.memBank | 0) * 4 + i;
        const cur = (ui._cur | 0) === m;
        sa(s.band, 'fill', cur ? '#18c3ff' : '#1a2430');
        st(s.top, `PATCH ${String(m + 1).padStart(2, '0')}`);
        st(s.st, cur ? '●' : '');
        sa(s.st, 'fill', '#18c3ff');
        st(s.name, short(A.memName(blk, m), 13));
        sa(s.name, 'fill', cur ? '#fff' : '#8794a6');
      }
    },
  });

  // ---- footswitches / buttons
  kit.hooks('zoom.zx6', (blk, name, ctl, phase) => {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    const fsm = ui._fsm ?? 2;
    if (name.startsWith('mode') && phase === 'press') {
      const m = +name.slice(4);
      if (m === fsm && m === 2) A.view(blk, 'home');
      else setMode(blk, m);
      return;
    }
    if (name === 'tap') { if (phase === 'down') A.tap(blk); return; }
    if (name === 'bank') {
      if (phase !== 'press') return;
      const d = ctl.dir;
      if (fsm === 2) { n.fsBank = ((n.fsBank | 0) + 1) % 2; kit.bump(blk); }
      else if (fsm === 0) A.recall(blk, ((ui._cur | 0) + d + 12) % 12);
      else if (fsm === 1) { n.memBank = ((n.memBank | 0) + d + 3) % 3; kit.bump(blk); }
      else setMode(blk, 2);
      return;
    }
    if (name.startsWith('fs')) {
      const i = +name.slice(2);
      if (fsm === 3) { if (phase === 'down') A.loop(blk, [1, 2, 4, 3][i]); return; }
      if (fsm === 2) { if (phase === 'down') { const si = (n.fsBank | 0) * 4 + i; A.toggle(blk, si); A.select(blk, si); } return; }
      // patch / memory: press = recall, hold = store here
      const m = (n.memBank | 0) * 4 + i;
      if (phase === 'hold') A.store(blk, m);
      else if (phase === 'press') A.recall(blk, m);
    }
  });

  // ---- enclosure
  tz.addForm('zoom-zx6', (ctx, d) => {
    const g = ctx.g, w = 560, h = 300;
    const col = d.color;
    formKit.body(g, w, h, col, { rx: 12 });
    // charcoal top plate + darker footswitch deck
    svg('rect', { x: 8, y: 8, width: 450, height: 140, rx: 8, fill: '#26282c', stroke: '#000', 'stroke-opacity': 0.5 }, g);
    svg('rect', { x: 8, y: 154, width: 450, height: 138, rx: 8, fill: '#151618', stroke: '#000', 'stroke-opacity': 0.5 }, g);
    svg('rect', { x: 8, y: 150, width: 450, height: 2, fill: '#3d4148' }, g);
    // treadle well
    svg('rect', { x: 466, y: 8, width: 86, height: 284, rx: 9, fill: '#0d0e10', stroke: '#000' }, g);
    const txt = '#d7dbe2';
    // brand + model
    label(g, 340, 128, 'ZX-6', { size: 21, fill: '#ffffff', font: ZFONT, weight: 800, ls: 2, anchor: 'start' });
    label(g, 344, 140, 'TOUCHBOARD MULTI-EFFECTS', { size: 4.6, fill: '#8a919c', weight: 700, ls: 1.2, anchor: 'start' });
    label(g, 290, 22, 'PLAY MODE', { size: 4.8, fill: '#8a919c', weight: 800, ls: 1.4 });
    // play-mode button caps (the FOOT plates sit on top of them)
    const modes = ['BANK/PATCH', 'MEMORY', 'EFFECT BOARD', 'LOOPER'];
    modes.forEach((m, i) => {
      const x = 258 + i * 52, y = 40;
      svg('rect', { x: x - 17, y: y - 7, width: 34, height: 14, rx: 3, fill: '#000', opacity: 0.55 }, g);
      svg('rect', { x: x - 16, y: y - 7.5, width: 32, height: 13, rx: 3, fill: '#3a3d43', stroke: '#111', 'stroke-width': 0.6 }, g);
      svg('rect', { x: x - 15, y: y - 7, width: 30, height: 5, rx: 2.5, fill: '#fff', opacity: 0.09 }, g);
      label(g, x, y + 13, m, { size: 4.2, fill: txt, weight: 800, ls: 0.4 });
    });
    // TAP cap
    svg('rect', { x: 241, y: 116, width: 34, height: 14, rx: 3, fill: '#3a3d43', stroke: '#111', 'stroke-width': 0.6 }, g);
    label(g, 258, 123.5, 'TAP', { size: 5, fill: txt, weight: 800, ls: 0.8 });
    // footswitch display bezels + switch labels
    for (let i = 0; i < 4; i++) label(g, 66 + i * 92, 268, String(i + 1), { size: 6, fill: '#8a919c', weight: 800 });
    label(g, 404, 262, '▼', { size: 5.4, fill: '#8a919c', weight: 800 });
    label(g, 440, 262, '▲', { size: 5.4, fill: '#8a919c', weight: 800 });
    label(g, 422, 272, 'BANK', { size: 4.4, fill: '#8a919c', weight: 800, ls: 1 });
    formKit.tzBadge(g, w / 2 - 50, h - 7, '#6e747e', 4.2);
    label(g, 509, 284, 'EXP', { size: 5, fill: '#8a919c', weight: 800, ls: 1 });
    const theme = { text: txt, knob: 'boss', labelSize: 5.2 };
    formKit.placeControls(ctx, d.controls, theme);
    const jacks = formKit.jacksTop(d, w, { flip: ctx.flip });
    jacks.push({ key: 'ic0', dir: 'in', port: 'c0', label: 'EXP 2', side: 'top', x: ctx.flip ? w * 0.7 : w * 0.3, y: -2, kind: 'ctrl' });
    return { w, h, theme, jacks };
  });

  const zx6Controls = () => {
    const c = [];
    c.push(Object.assign(SCREEN('zx6-touch', { interactive: true }), { x: 128, y: 80, w: 220, h: 124, bezel: '#050505' }));
    ['BANK/PATCH', 'MEMORY', 'EFFECT BOARD', 'LOOPER'].forEach((m, i) => {
      c.push(Object.assign(FOOT({ action: 'nav', nav: 'mode' + i, style: 'plate', label: '' }), { x: 258 + i * 52, y: 40, w: 32, h: 13 }));
      c.push(Object.assign(LED({ bind: 'fn', color: '#ff3b30', ledFn: (ui) => ((ui._fsm ?? 2) === i ? '#ff3b30' : null) }), { x: 258 + i * 52 + 12, y: 34.5, r: 1.6 }));
    });
    for (let k = 0; k < 4; k++) c.push(Object.assign(K('k' + (k + 1), String(k + 1), { virtual: true, def: 0.5 }), { x: 258 + k * 52, y: 86, r: 13, labelPos: 'above' }));
    c.push(Object.assign(FOOT({ action: 'nav', nav: 'tap', style: 'plate', label: '' }), { x: 258, y: 123, w: 34, h: 14 }));
    c.push(Object.assign(LED({ bind: 'fn', color: '#ff3b30', ledFn: (ui, b, st, now) => ((now / (60000 / (ui._bpm || 120))) % 1 < 0.15 ? '#ff3b30' : null) }), { x: 283, y: 123, r: 1.8 }));
    for (let i = 0; i < 4; i++) {
      const x = 66 + i * 92;
      c.push(Object.assign(SCREEN('zx6-fs', { idx: i }), { x, y: 182, w: 72, h: 26, bezel: '#000' }));
      c.push(Object.assign(FOOT({ action: 'nav', nav: 'fs' + i, style: 'stomp', label: '', holdMs: 900 }), { x, y: 238, r: 15 }));
      c.push(Object.assign(LED({ bind: 'fn', ledFn: (ui, b, stt, now) => fsLed(ui, b, stt, now, i) }), { x, y: 205, r: 2.6 }));
    }
    c.push(Object.assign(FOOT({ action: 'nav', nav: 'bank', dir: -1, style: 'stomp', label: '' }), { x: 404, y: 238, r: 11 }));
    c.push(Object.assign(FOOT({ action: 'nav', nav: 'bank', dir: 1, style: 'stomp', label: '' }), { x: 440, y: 238, r: 11 }));
    c.push(Object.assign(TREADLE('exp', { virtual: true, def: 1, color: '#1d1e21' }), { x: 509, y: 142, w: 66, h: 236 }));
    c.push(Object.assign(LED({ bind: 'fn', color: '#3ddc84', ledFn: (ui) => expLed(g6, ui) }), { x: 509, y: 16, r: 2.4 }));
    return c;
  };
  function fsLed(ui, b, stt, now, i) {
    const fsm = ui._fsm ?? 2, n = nav(b.id);
    if (fsm === 2) { const si = (n.fsBank | 0) * 4 + i; const x = g6.slot(ui, si); return x.m && x.on ? x.cat.color : null; }
    if (fsm === 3) {
      const tr = stt?.lpr?.looper?.tracks?.[0];
      if (!tr) return null;
      if (i === 0) return tr.state === 1 ? (now % 500 < 250 ? '#ff3030' : null) : tr.state === 2 ? '#3ddc84' : tr.state === 3 ? '#ffd23a' : null;
      if (i === 1) return tr.state === 4 ? '#ffffff' : null;
      return null;
    }
    return (ui._cur | 0) === (n.memBank | 0) * 4 + i ? '#18c3ff' : null;
  }
  function expLed(u, ui) {
    const t = ui._expT ?? 0;
    if (t === 3) return null;
    for (let i = 0; i < u.nSlots; i++) {
      const m = u.models[ui[`_m${i}`] ?? -1];
      if (m && m.pedal === 'wah' && (ui[`_o${i}`] ?? 0) > 0.5 && t !== 1) return '#3ddc84';
    }
    return null;
  }

  // ================================================================= SS-50+ compact LCD
  const MSC = { bg: '#04101f', ink: '#e9f1ff', dim: '#6b7f99', box: '#0b1d33' };
  tz.addScreen('ss50-lcd', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      R(g, 0, 0, w, h, { fill: MSC.bg });
      // chain of 6 (top line)
      s.chain = [];
      const bw = (w - 8) / 6;
      for (let i = 0; i < 6; i++) {
        const x = 4 + i * bw;
        const b = R(g, x + 0.6, 2, bw - 1.2, 6.2, { rx: 1, fill: '#123', stroke: 'none' });
        const t = T(g, x + bw / 2, 5.3, '', { size: 3.3, fill: '#000', font: MSMONO, weight: 700 });
        s.chain.push({ x, w: bw, b, t });
      }
      s.cursor = R(g, 4, 1.2, bw, 7.8, { rx: 1.4, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.7 });
      // name area
      s.catBar = R(g, 4, 11, 2, 12, { rx: 1, fill: '#fff' });
      s.name = T(g, 9, 15.6, '', { anchor: 'start', size: 9, fill: MSC.ink, font: ZFONT, weight: 700 });
      s.cat = T(g, 9, 21.6, '', { anchor: 'start', size: 3.6, fill: MSC.dim, font: MSMONO });
      s.onoff = T(g, w - 4, 15.6, '', { anchor: 'end', size: 5, fill: '#fff', font: MSMONO, weight: 700 });
      s.page = T(g, w - 4, 21.6, '', { anchor: 'end', size: 3.6, fill: MSC.dim, font: MSMONO });
      // 4 param cells under the knobs
      s.cells = [0, 1, 2, 3].map((k) => {
        const cw = (w - 6) / 4, x = 3 + k * cw;
        R(g, x + 0.4, 25, cw - 0.8, h - 27, { rx: 1.2, fill: MSC.box });
        return { l: T(g, x + cw / 2, 29, '', { size: 3.3, fill: MSC.dim, font: MSMONO }), v: T(g, x + cw / 2, h - 5.6, '', { size: 5.8, fill: MSC.ink, font: MSMONO, weight: 700 }) };
      });
      // type / memory overlay
      s.ov = svg('g', {}, g);
      R(s.ov, 0, 10, w, h - 10, { fill: MSC.bg });
      s.ovTitle = T(s.ov, w / 2, 13, '', { size: 3.6, fill: '#ffd23a', font: MSMONO, weight: 700 });
      s.ovRows = [-1, 0, 1].map((r) => T(s.ov, w / 2, 29 + r * 9.5, '', { size: r === 0 ? 8.6 : 5.4, fill: r === 0 ? '#fff' : MSC.dim, font: ZFONT, weight: 700 }));
      s.ovHint = T(s.ov, w / 2, h - 3, '', { size: 3.2, fill: MSC.dim, font: MSMONO });
      s.sig = '';
    },
    update(s, status, view, now) {
      const blk = view.block, ui = s.ui, n = nav(blk.id), w = s.w;
      let sig = `${n.view}|${n.t}|${n.sel}|${n.page}|${ui._cur}`;
      for (let i = 0; i < 6; i++) sig += `|${ui['_m' + i]}${ui['_o' + i]}`;
      for (let k = 0; k < 8; k++) sig += `|${(ui[`_p${n.sel}_${k}`] ?? 0).toFixed(3)}`;
      if (sig === s.sig) return;
      s.sig = sig;
      const Al = ms.alloc(ui);
      s.chain.forEach((c, i) => {
        const x = ms.slot(ui, i, Al);
        sa(c.b, 'fill', x.m ? x.cat.color : '#0f2038');
        sa(c.b, 'fill-opacity', x.m && !x.on ? 0.3 : 1);
        st(c.t, x.m ? x.cat.key : '');
      });
      sa(s.cursor, 'x', (s.chain[n.sel].x).toFixed(1));
      const x = ms.slot(ui, n.sel, Al);
      sa(s.catBar, 'fill', x.m ? x.cat.color : '#334');
      st(s.name, x.m ? x.m.name : 'THRU');
      st(s.cat, x.m ? `${x.cat.name}${x.over ? ' · DSP FULL' : ''}` : 'EMPTY SLOT · TYPE TO ADD');
      st(s.onoff, x.m ? (x.on ? 'ON' : 'OFF') : '');
      sa(s.onoff, 'fill', x.on ? x.cat.color : MSC.dim);
      st(s.page, x.m ? `PAGE ${n.page + 1}/${A.pages(blk)}` : '');
      s.cells.forEach((c, k) => {
        const p = x.m && x.m.params[n.page * 4 + k];
        st(c.l, p ? p.label : '');
        st(c.v, p ? fmt(p, x.val(n.page * 4 + k)) : '');
      });
      const ov = n.view === 'type' || n.view === 'memsel';
      sa(s.ov, 'display', ov ? 'inline' : 'none');
      if (n.view === 'type') {
        const list = ms.models.filter((m) => ms.allowed(n.sel).includes(m.cat));
        const ci = list.findIndex((m) => x.m && m.idx === x.m.idx);
        st(s.ovTitle, `TYPE · FX ${n.sel + 1} · ${x.m ? x.cat.name : 'EMPTY'}`);
        s.ovRows.forEach((r, j) => { const m = ci < 0 && j !== 1 ? null : list[(ci + j - 1 + list.length) % list.length]; st(r, j === 1 ? (x.m ? x.m.name : 'THRU') : m ? m.name : ''); });
        st(s.ovHint, '◀ ▶ TYPE · TYPE = EXIT');
      } else if (n.view === 'memsel') {
        const c = ui._cur | 0;
        st(s.ovTitle, 'PATCH SELECT');
        s.ovRows.forEach((r, j) => { const m = (c + j - 1 + 8) % 8; st(r, `${String(m + 1).padStart(2, '0')} ${A.memName(blk, m)}`); });
        st(s.ovHint, '◀ ▶ PATCH · TYPE = STORE · HOLD SW = EXIT');
      }
    },
    pointer(s, view, type, pt, e) {
      const blk = view.block, n = nav(blk.id), w = s.w;
      if (type === 'wheel') {
        const d = e.deltaY > 0 ? 1 : -1;
        if (n.view === 'type' || pt.y < 24 && pt.y > 9) A.stepModel(blk, n.sel, d);
        else if (n.view === 'memsel') A.recall(blk, ((tz.app.ui(blk)._cur | 0) + d + 8) % 8);
        else if (pt.y >= 24) { const k = Math.floor((pt.x - 3) / ((w - 6) / 4)); A.nudge(blk, n.sel, n.page * 4 + k, -d); }
        else A.selMove(blk, d);
        return;
      }
      if (type !== 'down') return;
      s.sig = '';
      if (pt.y < 10) { const i = s.chain.findIndex((c) => pt.x >= c.x && pt.x < c.x + c.w); if (i >= 0) { if (n.view !== 'home') A.view(blk, 'home'); A.select(blk, i); } return; }
      if (n.view === 'type') { A.stepModel(blk, n.sel, pt.y < 22 ? -1 : 1); return; }
      if (n.view === 'memsel') { A.recall(blk, ((tz.app.ui(blk)._cur | 0) + (pt.y < 22 ? -1 : 1) + 8) % 8); return; }
      if (pt.y < 24) { if (pt.x > w - 22) A.toggle(blk, n.sel); else A.view(blk, 'type'); return; }
      A.page(blk, 1);
    },
  });
  kit.hooks('zoom.ss50', (blk, name, ctl, phase) => {
    const n = nav(blk.id);
    if (name === 'sw') {
      if (phase === 'hold') A.view(blk, n.view === 'memsel' ? 'home' : 'memsel');
      else if (phase === 'press' && n.view !== 'memsel') A.toggle(blk, n.sel);
      return;
    }
    if (phase !== 'press') return;
    const ui = tz.app.ui(blk);
    if (name === 'left' || name === 'right') {
      const d = name === 'left' ? -1 : 1;
      if (n.view === 'type') A.stepModel(blk, n.sel, d);
      else if (n.view === 'memsel') A.recall(blk, ((ui._cur | 0) + d + 8) % 8);
      else A.selMove(blk, d);
    } else if (name === 'page') {
      if (n.view !== 'home') A.view(blk, 'home');
      A.page(blk, 1);
    } else if (name === 'type') {
      if (n.view === 'memsel') { A.store(blk, ui._cur | 0); return; }
      A.view(blk, n.view === 'type' ? 'home' : 'type');
    }
  });
  tz.addForm('zoom-ss50', (ctx, d) => {
    const g = ctx.g, w = 124, h = 212;
    formKit.body(g, w, h, d.color, { rx: 9 });
    svg('rect', { x: 5, y: 5, width: w - 10, height: 111, rx: 6, fill: '#1c1d20', stroke: '#000', 'stroke-opacity': 0.5 }, g);
    const txt = '#d5d9e0';
    // button caps for ◀ ▶ PAGE TYPE
    const cap = (x, y, t, wd = 16) => {
      svg('rect', { x: x - wd / 2 - 0.5, y: y - 4.5, width: wd + 1, height: 10, rx: 2.6, fill: '#000', opacity: 0.55 }, g);
      svg('rect', { x: x - wd / 2, y: y - 5, width: wd, height: 9, rx: 2.4, fill: '#46494f', stroke: '#111', 'stroke-width': 0.5 }, g);
      label(g, x, y - 0.5, t, { size: 4.6, fill: '#f2f4f7', weight: 800 });
    };
    cap(16, 103, '◀'); cap(108, 103, '▶'); cap(46, 103, 'PAGE', 20); cap(78, 103, 'TYPE', 20);
    label(g, w / 2, 124, 'SS-50+', { size: 14, fill: '#ffffff', font: ZFONT, weight: 800, ls: 1.4 });
    label(g, w / 2, 133, 'STACK STOMP', { size: 4.6, fill: '#8a919c', weight: 800, ls: 1.6 });
    formKit.tzBadge(g, w / 2, h - 7, '#6e747e', 4);
    const theme = { text: txt, knob: 'boss', labelSize: 4.8 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  // ================================================================= definitions
  const common = (u) => ({ algo: 'chain', opts: { chain: u.chain }, derive: u.derive, initParams: u.initParams, kind: 'Multi-FX', cat: 'Multi-FX', noBypassClick: true });
  const zx6 = def(Object.assign(common(g6), {
    id: 'zoom.zx6', name: 'ZX-6 Touchboard', ref: 'Zoom G6', brand: 'Zoom', code: 'ZX-6', logo: 'ZX-6', typeName: 'Touchscreen multi-effects', form: 'zoom-zx6', color: '#1a1b1e',
    stereo: 'stereo', ports: { ins: ['INPUT'], outs: ['OUTPUT L', 'OUTPUT R', 'PHONES'] }, jackKinds: { o2: 'phones' }, cost: 7,
    ctrl: { ins: [{ label: 'EXP 2', param: 'exp' }] },
    controls: zx6Controls(),
    initParams: Object.assign({}, g6.initParams, { _fsm: 2, _expT: 0, _lvl: 0, exp: 1 }),
    desc: 'Touchscreen floor unit with an 8-slot effect board, footswitch displays, a looper and an expression pedal. Tap a pedal to select it, tap again to edit, and pull down the top bar for the menu.',
  }));
  const ss50 = def(Object.assign(common(ms), {
    id: 'zoom.ss50', name: 'Stack Stomp 50+', ref: 'Zoom MS-50G+ MultiStomp', brand: 'Zoom', code: 'SS-50+', logo: 'SS-50+', typeName: 'Multi stomp', form: 'zoom-ss50', color: '#2b2d31',
    stereo: 'stereo', ports: { ins: ['INPUT'], outs: ['OUTPUT L/MONO', 'OUTPUT R'] }, cost: 5,
    controls: [
      Object.assign(SCREEN('ss50-lcd', { interactive: true }), { x: 62, y: 43, w: 100, h: 50, bezel: '#060606' }),
      ...[0, 1, 2, 3].map((k) => Object.assign(K('k' + (k + 1), String(k + 1), { virtual: true, def: 0.5 }), { x: 19 + k * 28.7, y: 82, r: 9.5, labelPos: 'none' })),
      Object.assign(FOOT({ action: 'nav', nav: 'left', style: 'plate', label: '' }), { x: 16, y: 102.5, w: 16, h: 9 }),
      Object.assign(FOOT({ action: 'nav', nav: 'right', style: 'plate', label: '' }), { x: 108, y: 102.5, w: 16, h: 9 }),
      Object.assign(FOOT({ action: 'nav', nav: 'page', style: 'plate', label: '' }), { x: 46, y: 102.5, w: 20, h: 9 }),
      Object.assign(FOOT({ action: 'nav', nav: 'type', style: 'plate', label: '' }), { x: 78, y: 102.5, w: 20, h: 9 }),
      Object.assign(FOOT({ action: 'nav', nav: 'sw', style: 'stomp', label: '', holdMs: 900 }), { x: 62, y: 172, r: 17 }),
      Object.assign(LED({ bind: 'fn', ledFn: (ui, b) => { const x = ms.slot(ui, nav(b.id).sel); return x.m && x.on ? x.cat.color : null; } }), { x: 62, y: 144, r: 2.6 }),
    ],
    initParams: Object.assign({}, ms.initParams, { _lvl: 0 }),
    desc: 'Compact multi-stomp with a chain of up to 6 effects. Arrows pick the effect, knobs 1-4 edit it, TYPE changes the model and holding the switch opens patch select.',
  }));
  tz.addDefs([zx6, ss50]);
  kit.register('zoom.zx6', g6);
  kit.register('zoom.ss50', ms);
}
