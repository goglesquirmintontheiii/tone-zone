// Built-in Tone Zone plugin: Hotone.
// hotone.amb2 – compact touchscreen amp modeler inspired by the Hotone Ampero II Stomp: 4.3" touchscreen with a
// 2 x 6 block grid (12 free blocks), three select knobs under the screen, VOLUME and MENU / VALUE knobs, a
// screen-lock button and three footswitches (stomp / preset mode). Names and artwork are Tone Zone originals.
import { makeKit, stdParts, stdLanes } from './mfx-kit.js';

export default function register(tz) {
  const { K, FOOT, LED, SCREEN, def } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;
  const kit = makeKit(tz);
  const { P, A, T, R, st, sa, fmt, nav } = kit;
  const S = stdParts(P);

  const CATS = [
    { key: 'DYN', name: 'Dynamics', color: '#f6c445' },
    { key: 'FLT', name: 'Filter', color: '#f28b4b' },
    { key: 'OD', name: 'Drive', color: '#ef5350' },
    { key: 'AMP', name: 'Amp', color: '#e5395f' },
    { key: 'CAB', name: 'Cab', color: '#b98a64' },
    { key: 'EQ', name: 'EQ', color: '#3cc9b4' },
    { key: 'MOD', name: 'Modulation', color: '#4c9dff' },
    { key: 'PIT', name: 'Pitch', color: '#9b7bff' },
    { key: 'DLY', name: 'Delay', color: '#5fd16b' },
    { key: 'RVB', name: 'Reverb', color: '#6f8cff' },
    { key: 'VOL', name: 'Volume', color: '#c9cdd4' },
  ];
  const v = {
    ts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 6, gainMaxDb: 40, tone: 'ts', toneLo: 723, postLp: 6500 },
    klon: { clip: 'si', cleanSum: true, cleanMix: 0.45, gainMinDb: 2, gainMaxDb: 34, tone: 'tilt', postLp: 9000 },
    bb: { clip: 'jfet', gainMinDb: 4, gainMaxDb: 32, tone: 'lp', toneLo: 1500, toneHi: 8000, postLp: 8000 },
    rat: { clip: 'si', gainMinDb: 12, gainMaxDb: 52, tone: 'rat', postLp: 7000 },
    muff: { clip: 'muff', stages: 2, stage2Db: 12, gainMinDb: 16, gainMaxDb: 50, tone: 'blend', postLp: 6000 },
    od1: { clip: 'asym', gainMinDb: 6, gainMaxDb: 38, tone: 'lp', toneLo: 1200, toneHi: 7000, postLp: 7000 },
    boost: { clip: 'clean', gainMinDb: 0, gainMaxDb: 20, tone: 'tilt' },
  };
  const CABL = ['1x12us', '2x12twin', '4x10tweed', '2x12blue', '4x12gb', '4x12v30', '4x12t75', '2x12cream'];
  const LIB = [
    { name: 'Studio Comp', cat: 'DYN', ...S.comp('cmp') },
    { name: 'Orange Squash', cat: 'DYN', ...S.comp('cmpO') },
    { name: 'Noise Gate', cat: 'DYN', ...S.gate() },
    { name: 'Touch Wah', cat: 'FLT', ...S.wah(2) },
    { name: 'Classic Wah', cat: 'FLT', pedal: 'wah', ...S.wah(0) },
    { name: 'Step Filter', cat: 'FLT', ...S.wah(1, 0) },
    { name: 'Screamer', cat: 'OD', ...S.drv(v.ts), params: [P('Drive', 'gain', 0.45), P('Tone', 'tone', 0.5), P('Level', 'level', 0.55)] },
    { name: 'Centavo', cat: 'OD', ...S.drv(v.klon), params: [P('Gain', 'gain', 0.3), P('Treble', 'tone', 0.55), P('Output', 'level', 0.55)] },
    { name: 'Blues Breaker', cat: 'OD', ...S.drv(v.bb), params: [P('Gain', 'gain', 0.45), P('Tone', 'tone', 0.5), P('Volume', 'level', 0.5)] },
    { name: 'Crunch OD', cat: 'OD', ...S.drv(v.od1), params: [P('Drive', 'gain', 0.45), P('Tone', 'tone', 0.5), P('Level', 'level', 0.5)] },
    { name: 'Rodent', cat: 'OD', ...S.drv(v.rat), params: [P('Dist', 'gain', 0.5), P('Filter', 'tone', 0.45), P('Volume', 'level', 0.45)] },
    { name: 'Big Fuzz', cat: 'OD', ...S.drv(v.muff), params: [P('Sustain', 'gain', 0.55), P('Tone', 'tone', 0.5), P('Volume', 'level', 0.45)] },
    { name: 'Pure Boost', cat: 'OD', ...S.drv(v.boost), params: [P('Boost', 'gain', 0.4), P('Tone', 'tone', 0.5), P('Level', 'level', 0.5)] },
    { name: 'Tweed Lux', cat: 'AMP', ...S.amp('deluxe', { gain: 0.45 }) },
    { name: 'Black Twin', cat: 'AMP', ...S.amp('twin', { gain: 0.3 }) },
    { name: 'AC Top', cat: 'AMP', ...S.amp('ac30', { gain: 0.45 }) },
    { name: 'Hiway 100', cat: 'AMP', ...S.amp('hiwatt', { gain: 0.45 }) },
    { name: 'Brit Plexi', cat: 'AMP', ...S.amp('plexi', { gain: 0.55 }) },
    { name: 'Brit 800', cat: 'AMP', ...S.amp('jcm800', { gain: 0.55 }) },
    { name: 'Mod Brown', cat: 'AMP', ...S.amp('friedman', { gain: 0.6 }) },
    { name: 'SL Lead', cat: 'AMP', ...S.amp('slo', { gain: 0.55 }) },
    { name: 'US Rect', cat: 'AMP', ...S.amp('recto', { gain: 0.6 }) },
    { name: 'Purple 51', cat: 'AMP', ...S.amp('5150', { gain: 0.55 }) },
    { name: 'Citrus 120', cat: 'AMP', ...S.amp('orange', { gain: 0.55 }) },
    { name: 'Dumb ODS', cat: 'AMP', ...S.amp('dumble', { gain: 0.45 }) },
    ...CABL.map((c) => ({ name: c.replace(/^(\dx\d+)(.*)$/, (m, a, b) => `${a} ${b.toUpperCase()}`), cat: 'CAB', ...S.cab(c) })),
    { name: 'Graphic EQ', cat: 'EQ', ...S.eq() },
    { name: 'Para EQ', cat: 'EQ', ...S.peq() },
    { name: 'Chorus', cat: 'MOD', ...S.chorus(0) },
    { name: 'Dimension', cat: 'MOD', ...S.chorus(3, { rate: 0.2 }) },
    { name: 'Flanger', cat: 'MOD', ...S.flanger(0) },
    { name: 'Phaser 90', cat: 'MOD', ...S.phaser(4) },
    { name: 'Opto Trem', cat: 'MOD', ...S.trem(0) },
    { name: 'U-Vibe', cat: 'MOD', ...S.vibe() },
    { name: 'Rotary', cat: 'MOD', ...S.rotary() },
    { name: 'Octave', cat: 'PIT', ...S.pitch(1 / 7, { mix: 0.6 }) },
    { name: 'Pitch Shift', cat: 'PIT', ...S.pitch(6 / 7, { mix: 0.4 }) },
    { name: 'Ring Mod', cat: 'PIT', ...S.ring() },
    { name: 'Digital', cat: 'DLY', ...S.dly(0) },
    { name: 'Analog', cat: 'DLY', ...S.dly(1, [P('Tone', 'tone', 0.4)]) },
    { name: 'Tape Echo', cat: 'DLY', ...S.dly(2, [P('Wow', 'moddepth', 0.25), P('Age', 'age', 0.35)]) },
    { name: 'Mod Delay', cat: 'DLY', ...S.dly(4, [P('Rate', 'modrate', 0.3), P('Depth', 'moddepth', 0.4)]) },
    { name: 'Ping Pong', cat: 'DLY', ...S.dly(7, [P('Spread', 'spread', 0.8)]) },
    { name: 'Room', cat: 'RVB', ...S.rev(0) },
    { name: 'Hall', cat: 'RVB', ...S.rev(1) },
    { name: 'Plate', cat: 'RVB', ...S.rev(2) },
    { name: 'Spring', cat: 'RVB', ...S.rev(3) },
    { name: 'Shimmer', cat: 'RVB', ...S.rev(4, [P('Shimmer', 'shimmer', 0.5)]) },
    { name: 'Volume', cat: 'VOL', pedal: 'vol', ...S.vol() },
  ];
  // Hotone shows parameter names in title case
  LIB.forEach((m) => m.params.forEach((p) => (p.label = p.label.length >= 3 && !p.label.includes('.') ? p.label[0] + p.label.slice(1).toLowerCase() : p.label)));
  const amb = kit.unit({
    id: 'hotone.amb2', slots: 12, knobs: 3, cats: CATS, models: LIB, exp: true, memPrefix: 'Preset',
    lanes: stdLanes({ drv: 2, dly: 2 }),
    patch: [['Studio Comp', true, { Sustain: 0.4 }], ['Noise Gate', true, { Thresh: 0.25 }], ['Centavo', false], ['Brit 800', true, { Gain: 0.5 }], ['4x12 GB', true], ['Graphic EQ', false], ['Chorus', false], ['Analog', true, { Mix: 0.22 }], ['Hall', true, { Mix: 0.22 }], null, null, null],
    mems: [
      { name: 'Brit Crunch' },
      { name: 'Chimey Clean', patch: [['Studio Comp', true], null, null, ['AC Top', true, { Gain: 0.35 }], ['2x12 BLUE', true], null, ['Chorus', true, { Mix: 0.4 }], ['Digital', true, { Mix: 0.2 }], ['Plate', true, { Mix: 0.3 }], null, null, null] },
      { name: 'Modern Lead', patch: [null, ['Noise Gate', true, { Thresh: 0.4 }], ['Screamer', true, { Drive: 0.2, Level: 0.7 }], ['US Rect', true], ['4x12 V30', true], ['Para EQ', false], ['Phaser 90', false], ['Digital', true, { Mix: 0.25 }], ['Room', true, { Mix: 0.18 }], null, null, null] },
      { name: 'Vibe Fuzz', patch: [null, null, ['Big Fuzz', true], ['Tweed Lux', true, { Gain: 0.4 }], ['1x12 US', true], null, ['U-Vibe', true], ['Tape Echo', true, { Mix: 0.25 }], ['Spring', true, { Mix: 0.25 }], null, null, null] },
    ],
  });

  // ---------------------------------------------------------------- screen: graphite touch UI, coral accent
  const C = { bg: '#0b0c0f', tile: '#17191e', line: '#262a31', acc: '#ff6a3d', ink: '#f5f6f8', dim: '#7c8390' };
  const HF = "Helvetica, 'FreeSans', 'Liberation Sans', Arial, sans-serif";
  const NP = 8; // presets
  const SET = [
    { label: 'Footswitch mode', get: (ui) => ['Stomp', 'Preset'][ui._fsm | 0], step: (blk, ui) => tz.app.setParam(blk.id, '_fsm', (ui._fsm | 0) ? 0 : 1) },
    { label: 'EXP pedal', get: (ui) => ['Auto', 'Volume', 'Wah', 'Off'][ui._expT ?? 0], step: (blk, ui, d) => tz.app.setParam(blk.id, '_expT', ((ui._expT ?? 0) + d + 4) % 4) },
    { label: 'Tempo', get: (ui) => `${ui._bpm || 120} BPM`, step: (blk, ui, d) => A.setBpm(blk, (ui._bpm || 120) + d) },
    { label: 'Output', get: (ui) => `${(ui._lvl ?? 0) > 0 ? '+' : ''}${(ui._lvl ?? 0).toFixed(1)} dB`, step: (blk, ui, d) => tz.app.setParam(blk.id, '_lvl', Math.max(-24, Math.min(12, (ui._lvl ?? 0) + d * 0.5))) },
  ];
  const fsOf = (ui, i) => ui[`_fa${i}`] ?? -1; // which footswitch (0-2) a block is assigned to, -1 none
  const DEF_FS = { 2: 0, 6: 1, 7: 2 };

  tz.addScreen('amb2-touch', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      R(g, 0, 0, w, h, { fill: C.bg });
      // top bar
      s.tPre = T(g, 5, 6.5, '', { anchor: 'start', size: 4.4, fill: C.acc, font: HF, weight: 700 });
      s.tName = T(g, 24, 6.5, '', { anchor: 'start', size: 5.4, fill: C.ink, font: HF, weight: 700 });
      s.tRight = T(g, w - 5, 6.5, '', { anchor: 'end', size: 4, fill: C.dim, font: HF });
      s.lock = T(g, w - 46, 6.5, '', { anchor: 'end', size: 4, fill: C.acc, font: HF, weight: 700 });
      svg('line', { x1: 0, x2: w, y1: 12.5, y2: 12.5, stroke: C.line, 'stroke-width': 0.6 }, g);
      const V = (n) => (s[n] = svg('g', {}, g));
      // GRID: 2 x 6 blocks
      V('vGrid');
      const tw = (w - 8) / 6, th = 22;
      s.tiles = [];
      for (let i = 0; i < 12; i++) {
        const x = 4 + (i % 6) * tw, y = 16 + Math.floor(i / 6) * (th + 9);
        const bg = R(s.vGrid, x + 1, y, tw - 2, th, { rx: 3.5, fill: C.tile, stroke: C.line, 'stroke-width': 0.6 });
        const dot = svg('circle', { cx: x + 5, cy: y + 4.5, r: 1.6, fill: '#333' }, s.vGrid);
        const cat = T(s.vGrid, x + tw - 3.5, y + 4.8, '', { anchor: 'end', size: 3.2, fill: C.dim, font: HF, weight: 700 });
        const nm = T(s.vGrid, x + tw / 2, y + 13.5, '', { size: 3.8, fill: C.ink, font: HF, weight: 700 });
        const fs = T(s.vGrid, x + tw / 2, y + 19, '', { size: 3, fill: C.acc, font: HF, weight: 700 });
        s.tiles.push({ x, y, w: tw, h: th, bg, dot, cat, nm, fs });
      }
      // signal line between the rows
      svg('path', { d: `M4 ${16 + th + 4.5} H${w - 4}`, stroke: '#30353d', 'stroke-width': 0.6, 'stroke-dasharray': '1.5 1.5' }, s.vGrid);
      s.kc = [0, 1, 2].map((k) => {
        const cw = (w - 8) / 3, x = 4 + k * cw;
        R(s.vGrid, x + 1, 72, cw - 2, 15, { rx: 3, fill: '#121419' });
        const l = T(s.vGrid, x + 5, 76.5, '', { anchor: 'start', size: 3.6, fill: C.dim, font: HF });
        const val = T(s.vGrid, x + cw - 5, 82.5, '', { anchor: 'end', size: 5.6, fill: C.ink, font: HF, weight: 700 });
        const arc = R(s.vGrid, x + 5, 83.4, 0, 1.4, { rx: 0.7, fill: C.acc });
        return { l, val, arc, cw };
      });
      // EDIT
      V('vEdit');
      s.eBack = T(s.vEdit, 6, 19.5, '‹', { size: 10, fill: C.acc, font: HF });
      s.eDot = svg('circle', { cx: 15, cy: 19.5, r: 2, fill: '#555' }, s.vEdit);
      s.eName = T(s.vEdit, 20, 19.5, '', { anchor: 'start', size: 7, fill: C.ink, font: HF, weight: 700 });
      s.eSw = R(s.vEdit, w - 26, 15, 22, 9, { rx: 4.5, fill: '#2a2e35' });
      s.eKnob = svg('circle', { cx: w - 21, cy: 19.5, r: 3.4, fill: '#fff' }, s.vEdit);
      s.eFs = R(s.vEdit, w - 52, 15, 22, 9, { rx: 2, fill: 'none', stroke: C.line, 'stroke-width': 0.6 });
      s.eFsT = T(s.vEdit, w - 41, 19.6, '', { size: 3.8, fill: C.dim, font: HF, weight: 700 });
      s.eModel = T(s.vEdit, 20, 26.5, '', { anchor: 'start', size: 3.6, fill: C.acc, font: HF, weight: 700 });
      s.sl = [];
      for (let k = 0; k < 8; k++) {
        const col = k % 2, row = Math.floor(k / 2);
        const x = 5 + col * ((w - 10) / 2), y = 32 + row * 13.5, sw = (w - 10) / 2 - 6;
        const bg = R(s.vEdit, x - 1, y - 1, sw + 4, 12.5, { rx: 2.5, fill: 'none', stroke: 'none', 'stroke-width': 0.7 });
        const l = T(s.vEdit, x + 1, y + 3, '', { anchor: 'start', size: 3.7, fill: C.dim, font: HF });
        const val = T(s.vEdit, x + sw, y + 3, '', { anchor: 'end', size: 3.9, fill: C.ink, font: HF, weight: 700 });
        R(s.vEdit, x + 1, y + 7.4, sw - 1, 1.6, { rx: 0.8, fill: '#262a31' });
        const bar = R(s.vEdit, x + 1, y + 7.4, 0, 1.6, { rx: 0.8, fill: C.acc });
        const kb = T(s.vEdit, x + sw - 13, y + 3, '', { anchor: 'end', size: 3.2, fill: C.acc, font: HF, weight: 700 });
        s.sl.push({ x, y, sw, bg, l, val, bar, kb });
      }
      // PICK: category tabs + model grid
      V('vPick');
      s.tabs = CATS.map((c, i) => {
        const tw2 = (w - 4) / CATS.length, x = 2 + i * tw2;
        const bg = R(s.vPick, x + 0.4, 15, tw2 - 0.8, 9, { rx: 2, fill: C.tile });
        const t = T(s.vPick, x + tw2 / 2, 19.6, c.key, { size: 3.2, fill: C.dim, font: HF, weight: 700 });
        return { x, w: tw2, bg, t };
      });
      s.cells = [];
      for (let i = 0; i < 12; i++) {
        const cw = (w - 8) / 3, x = 4 + (i % 3) * cw, y = 28 + Math.floor(i / 3) * 14;
        const bg = R(s.vPick, x + 1, y, cw - 2, 12, { rx: 2.5, fill: C.tile, stroke: 'none', 'stroke-width': 0.8 });
        const t = T(s.vPick, x + cw / 2, y + 6.2, '', { size: 4.4, fill: C.ink, font: HF, weight: 700 });
        s.cells.push({ x, y, w: cw, bg, t });
      }
      s.pClear = T(s.vPick, w - 6, h - 3.5, 'Remove block', { anchor: 'end', size: 3.6, fill: '#ff6b6b', font: HF, weight: 700 });
      s.pBack = T(s.vPick, 6, h - 3.5, '‹ Back', { anchor: 'start', size: 3.6, fill: C.acc, font: HF, weight: 700 });
      // PRESETS
      V('vPre');
      s.prow = [];
      for (let i = 0; i < NP; i++) {
        const cw = (w - 8) / 2, x = 4 + (i % 2) * cw, y = 16 + Math.floor(i / 2) * 18;
        const bg = R(s.vPre, x + 1, y, cw - 2, 16, { rx: 3, fill: C.tile, stroke: 'none', 'stroke-width': 0.8 });
        const n = T(s.vPre, x + 6, y + 8, '', { anchor: 'start', size: 4, fill: C.acc, font: HF, weight: 700 });
        const t = T(s.vPre, x + 20, y + 8, '', { anchor: 'start', size: 5, fill: C.ink, font: HF, weight: 700 });
        s.prow.push({ x, y, w: cw, bg, n, t });
      }
      // SETTINGS
      V('vSet');
      T(s.vSet, 6, 19, 'Settings', { anchor: 'start', size: 6, fill: C.ink, font: HF, weight: 700 });
      s.srow = SET.map((it, i) => {
        const y = 25 + i * 15;
        const bg = R(s.vSet, 4, y, w - 8, 13, { rx: 3, fill: C.tile });
        T(s.vSet, 9, y + 6.6, it.label, { anchor: 'start', size: 4.6, fill: C.ink, font: HF });
        R(s.vSet, w - 62, y + 2, 9, 9, { rx: 2, fill: '#262a31' });
        T(s.vSet, w - 57.5, y + 6.6, '–', { size: 6, fill: C.ink, font: HF });
        R(s.vSet, w - 14, y + 2, 9, 9, { rx: 2, fill: '#262a31' });
        T(s.vSet, w - 9.5, y + 6.6, '+', { size: 6, fill: C.ink, font: HF });
        const val = T(s.vSet, w - 33, y + 6.6, '', { size: 4.6, fill: C.acc, font: HF, weight: 700 });
        return { y, bg, val };
      });
      s.views = ['vGrid', 'vEdit', 'vPick', 'vPre', 'vSet'];
      s.sig = '';
    },
    update(s, status, view) {
      const blk = view.block, ui = s.ui, n = nav(blk.id), w = s.w;
      let sig = `${n.view}|${n.t}|${n.sel}|${n.page}|${n.cat}|${n.pf}|${n.lock ? 1 : 0}|${ui._cur}|${ui._fsm}|${ui._bpm}|${ui._expT}|${ui._lvl}`;
      for (let i = 0; i < 12; i++) sig += `|${ui['_m' + i]}${ui['_o' + i]}${ui['_fa' + i]}`;
      for (let k = 0; k < 8; k++) sig += `|${(ui[`_p${n.sel}_${k}`] ?? 0).toFixed(3)}`;
      if (sig === s.sig) return;
      s.sig = sig;
      const vn = { grid: 'vGrid', home: 'vGrid', edit: 'vEdit', pick: 'vPick', pre: 'vPre', set: 'vSet' }[n.view] || 'vGrid';
      if (s.curV !== vn) { for (const k of s.views) sa(s[k], 'display', k === vn ? 'inline' : 'none'); s.curV = vn; }
      const cur = ui._cur | 0;
      st(s.tPre, `A-${String(cur + 1).padStart(2, '0')}`);
      st(s.tName, A.memName(blk, cur));
      st(s.tRight, `${(ui._fsm | 0) ? 'Preset' : 'Stomp'} · ${ui._bpm || 120} BPM`);
      st(s.lock, n.lock ? '🔒 Locked' : '');
      const Al = amb.alloc(ui);
      const x = amb.slot(ui, n.sel, Al);
      if (vn === 'vGrid') {
        s.tiles.forEach((t, i) => {
          const y = amb.slot(ui, i, Al);
          const sel = i === n.sel;
          sa(t.bg, 'stroke', sel ? C.acc : C.line);
          sa(t.bg, 'stroke-width', sel ? 1.1 : 0.6);
          sa(t.bg, 'fill', y.m ? (y.on ? '#1d2128' : '#121418') : '#0e0f12');
          sa(t.dot, 'fill', y.m ? (y.over ? '#ff3b30' : y.on ? y.cat.color : '#3a3f47') : 'none');
          st(t.cat, y.m ? y.cat.key : '');
          st(t.nm, y.m ? (y.m.name.length > 10 ? y.m.name.slice(0, 9) + '…' : y.m.name) : '+');
          sa(t.nm, 'fill', y.m ? (y.on ? C.ink : C.dim) : '#3a3f47');
          const f = fsOf(ui, i);
          st(t.fs, y.over ? 'DSP FULL' : f >= 0 && !(ui._fsm | 0) ? `FS${f + 1}` : '');
        });
        s.kc.forEach((c, k) => {
          const p = x.m && x.m.params[n.page * 3 + k];
          st(c.l, p ? p.label : '');
          st(c.val, p ? fmt(p, x.val(n.page * 3 + k)) : '');
          sa(c.arc, 'width', p ? (x.val(n.page * 3 + k) * (c.cw - 10)).toFixed(1) : 0);
        });
      } else if (vn === 'vEdit') {
        if (!x.m) { n.view = 'pick'; s.sig = ''; return; }
        st(s.eName, x.m.name);
        st(s.eModel, `${x.cat.name} · block ${n.sel + 1}${x.over ? ' · DSP FULL' : ''}  ›  change`);
        sa(s.eDot, 'fill', x.cat.color);
        sa(s.eSw, 'fill', x.on ? C.acc : '#2a2e35');
        sa(s.eKnob, 'cx', x.on ? w - 9 : w - 21);
        const f = fsOf(ui, n.sel);
        st(s.eFsT, f >= 0 ? `FS ${f + 1}` : 'FS –');
        sa(s.eFsT, 'fill', f >= 0 ? C.acc : C.dim);
        s.sl.forEach((r, k) => {
          const p = x.m.params[k];
          const live = p && Math.floor(k / 3) === n.page;
          st(r.l, p ? p.label : '');
          st(r.val, p ? fmt(p, x.val(k)) : '');
          sa(r.bar, 'width', p ? (x.val(k) * (r.sw - 1)).toFixed(1) : 0);
          sa(r.bg, 'stroke', p && k === (n.pf | 0) ? C.acc : 'none');
          st(r.kb, live ? `K${(k % 3) + 1}` : '');
        });
      } else if (vn === 'vPick') {
        const cat = CATS[n.cat | 0];
        s.tabs.forEach((t, i) => { sa(t.bg, 'fill', i === (n.cat | 0) ? CATS[i].color : C.tile); sa(t.t, 'fill', i === (n.cat | 0) ? '#111' : C.dim); });
        const list = amb.inCat(cat.key);
        s.cells.forEach((c, i) => {
          const m = list[(n.top | 0) + i];
          st(c.t, m ? m.name : '');
          sa(c.bg, 'fill', m ? C.tile : 'none');
          sa(c.bg, 'stroke', m && x.m && m.idx === x.m.idx ? cat.color : 'none');
        });
        st(s.pClear, x.m ? 'Remove block' : '');
      } else if (vn === 'vPre') {
        s.prow.forEach((r, i) => {
          st(r.n, `A-${String(i + 1).padStart(2, '0')}`);
          st(r.t, A.memName(blk, i));
          sa(r.bg, 'stroke', i === cur ? C.acc : 'none');
        });
      } else {
        s.srow.forEach((r, i) => st(r.val, SET[i].get(ui)));
      }
    },
    pointer(s, view, type, pt, e, editor) {
      const blk = view.block, n = nav(blk.id), ui = tz.app.ui(blk), w = s.w, h = s.h;
      if (n.lock) { if (type === 'down') tz.ui.toast('Screen locked – press LOCK to unlock', 'info', 1000); return; }
      if (type === 'wheel') {
        const d = e.deltaY > 0 ? 1 : -1;
        if (n.view === 'edit') A.nudge(blk, n.sel, n.pf | 0, -d);
        else if (n.view === 'pick') { const L = amb.inCat(CATS[n.cat | 0].key).length; n.top = Math.max(0, Math.min(Math.max(0, Math.ceil((L - 12) / 3) * 3), (n.top | 0) + d * 3)); kit.bump(blk); }
        else A.selMove(blk, d);
        return;
      }
      if (type === 'move' && s.drag) {
        A.setVal(blk, n.sel, s.drag.k, s.drag.v0 + (pt.x - s.drag.x0) / s.drag.sw * (e.shiftKey ? 0.25 : 1));
        return;
      }
      if (type === 'up') { s.drag = null; return; }
      if (type !== 'down') return;
      s.sig = '';
      if (pt.y < 12.5) { A.view(blk, n.view === 'pre' ? 'grid' : 'pre'); return; }
      switch (n.view) {
        case 'pre': {
          const i = s.prow.findIndex((r) => pt.x >= r.x && pt.x < r.x + r.w && pt.y >= r.y && pt.y < r.y + 16);
          if (i >= 0) { A.recall(blk, i); A.view(blk, 'grid'); }
          return;
        }
        case 'set': {
          const i = s.srow.findIndex((r) => pt.y >= r.y && pt.y < r.y + 13);
          if (i < 0) { A.view(blk, 'grid'); return; }
          if (pt.x > w - 64) SET[i].step(blk, ui, pt.x > w - 16 ? 1 : pt.x < w - 52 ? -1 : 1);
          kit.bump(blk);
          return;
        }
        case 'edit': {
          if (pt.y < 29) {
            if (pt.x < 12) A.view(blk, 'grid');
            else if (pt.x > w - 28) A.toggle(blk, n.sel);
            else if (pt.x > w - 54) assignFs(blk, n.sel);
            else { const x = amb.slot(ui, n.sel); n.cat = Math.max(0, CATS.findIndex((c) => c.key === x.m?.cat)); n.top = 0; A.view(blk, 'pick'); }
            return;
          }
          const k = s.sl.findIndex((r) => pt.x >= r.x - 2 && pt.x < r.x + r.sw + 3 && pt.y >= r.y - 1 && pt.y < r.y + 12);
          const x = amb.slot(ui, n.sel);
          if (k >= 0 && x.m && x.m.params[k]) {
            n.pf = k;
            if (Math.floor(k / 3) !== n.page) { n.page = Math.floor(k / 3); kit.syncKnobs(blk); }
            s.drag = { k, v0: x.val(k), x0: pt.x, sw: s.sl[k].sw };
            kit.bump(blk);
          }
          return;
        }
        case 'pick': {
          if (pt.y < 26) { const i = s.tabs.findIndex((t) => pt.x >= t.x && pt.x < t.x + t.w); if (i >= 0) { n.cat = i; n.top = 0; kit.bump(blk); } return; }
          if (pt.y > h - 8) { if (pt.x < 30) A.view(blk, amb.slot(ui, n.sel).m ? 'edit' : 'grid'); else if (pt.x > w - 40) { A.setModel(blk, n.sel, -1); A.view(blk, 'grid'); } return; }
          const i = s.cells.findIndex((c) => pt.x >= c.x && pt.x < c.x + c.w && pt.y >= c.y && pt.y < c.y + 12);
          const m = i >= 0 && amb.inCat(CATS[n.cat | 0].key)[(n.top | 0) + i];
          if (m) { A.setModel(blk, n.sel, m.idx); n.pf = 0; A.view(blk, 'edit'); }
          return;
        }
        default: {
          const i = s.tiles.findIndex((t) => pt.x >= t.x && pt.x < t.x + t.w && pt.y >= t.y && pt.y < t.y + t.h);
          if (i >= 0) {
            const x = amb.slot(ui, i);
            if (i === n.sel) { if (x.m) { n.pf = 0; A.view(blk, 'edit'); } else { n.cat = 0; n.top = 0; A.view(blk, 'pick'); } }
            else A.select(blk, i);
            return;
          }
          if (pt.y > 70) A.page(blk, 1);
        }
      }
    },
    // double tap on a block toggles it (like the real grid)
  });
  function assignFs(blk, i) {
    const ui = tz.app.ui(blk);
    const cur = fsOf(ui, i);
    const nx = cur >= 2 ? -1 : cur + 1;
    // a footswitch drives one block: free it elsewhere
    if (nx >= 0) for (let k = 0; k < 12; k++) if (k !== i && fsOf(ui, k) === nx) tz.app.setParam(blk.id, `_fa${k}`, -1);
    tz.app.setParam(blk.id, `_fa${i}`, nx);
    kit.bump(blk);
  }
  // VALUE encoder: edits the focused parameter of the block being edited (or browses blocks on the grid)
  tz.bus.on('param', ({ id, p, v: val }) => {
    if (p !== 'kv') return;
    const blk = kit.blockOf(id);
    if (!blk || blk.type !== 'hotone.amb2') return;
    const n = nav(id);
    if (n.lock) return;
    const prev = n.kvLast ?? val;
    n.kvLast = val;
    const d = val - prev;
    if (Math.abs(d) < 1e-6) return;
    if (n.view === 'edit') {
      const ui = tz.app.ui(blk);
      const x = amb.slot(ui, n.sel);
      const k = n.pf | 0;
      if (x.m && x.m.params[k]) A.setVal(blk, n.sel, k, x.val(k) + d);
    } else if (n.view === 'grid' || n.view === 'home') {
      n.kvAcc = (n.kvAcc || 0) + d;
      if (Math.abs(n.kvAcc) > 0.06) { A.selMove(blk, n.kvAcc > 0 ? 1 : -1); n.kvAcc = 0; }
    } else if (n.view === 'set') {
      n.kvAcc = (n.kvAcc || 0) + d;
      if (Math.abs(n.kvAcc) > 0.05) { SET[n.sv | 0].step(blk, tz.app.ui(blk), n.kvAcc > 0 ? 1 : -1); n.kvAcc = 0; kit.bump(blk); }
    }
  });

  kit.hooks('hotone.amb2', (blk, name, ctl, phase) => {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    if (name === 'lock') { if (phase === 'press') { n.lock = !n.lock; kit.bump(blk); tz.ui.toast(n.lock ? 'Screen locked' : 'Screen unlocked', 'info', 900); } return; }
    if (name === 'menu') {
      // press: grid → edit the selected block → settings → grid; hold: settings
      if (phase === 'hold') { A.view(blk, 'set'); return; }
      if (phase !== 'press') return;
      const x = amb.slot(ui, n.sel);
      if (n.view === 'grid' || n.view === 'home') { if (x.m) { n.pf = 0; A.view(blk, 'edit'); } else A.view(blk, 'pick'); }
      else if (n.view === 'edit') { n.pf = ((n.pf | 0) + 1) % Math.max(1, x.m ? x.m.params.length : 1); kit.bump(blk); }
      else A.view(blk, 'grid');
      return;
    }
    if (name.startsWith('fs')) {
      const i = +name.slice(2);
      if (i === 2 && phase === 'hold') { tz.app.setParam(blk.id, '_fsm', (ui._fsm | 0) ? 0 : 1); kit.bump(blk); tz.ui.toast((ui._fsm | 0) ? 'Stomp mode' : 'Preset mode', 'info', 900); return; }
      if (phase !== 'press') return;
      if ((ui._fsm | 0) === 1) {
        if (i === 2) A.tap(blk);
        else A.recall(blk, ((ui._cur | 0) + (i ? 1 : -1) + NP) % NP);
        return;
      }
      for (let k = 0; k < 12; k++) if (fsOf(ui, k) === i) { A.toggle(blk, k); return; }
    }
  });

  // ---------------------------------------------------------------- enclosure
  tz.addForm('hotone-amb2', (ctx, d) => {
    const g = ctx.g, w = 264, h = 230;
    formKit.body(g, w, h, d.color, { rx: 10 });
    svg('rect', { x: 6, y: 6, width: w - 12, height: 152, rx: 7, fill: '#131416', stroke: '#000', 'stroke-opacity': 0.5 }, g);
    svg('path', { d: `M6 162 H${w - 6}`, stroke: '#e8452c', 'stroke-width': 1.2, 'stroke-opacity': 0.9 }, g);
    const txt = '#e6e7ea', dim = '#8a8f98';
    // lock button cap
    svg('rect', { x: 205, y: 110, width: 32, height: 10, rx: 5, fill: '#2d3036', stroke: '#0a0a0a', 'stroke-width': 0.5 }, g);
    label(g, 221, 115.3, 'LOCK', { size: 4.2, fill: txt, weight: 800, ls: 0.8 });
    label(g, 221, 140, 'AMBERA II', { size: 8.6, fill: '#fff', font: "Helvetica, 'FreeSans', Arial, sans-serif", weight: 700, ls: 1 });
    label(g, 221, 148, 'STOMP', { size: 4, fill: '#e8452c', weight: 800, ls: 2.2 });
    ['1', '2', '3'].forEach((t, i) => label(g, 46 + i * 86, 221, `FS ${t}`, { size: 4.6, fill: dim, weight: 800, ls: 0.8 }));
    formKit.tzBadge(g, 132, 226, '#5d636b', 3.4);
    const theme = { text: txt, knob: 'chrome', labelSize: 4.6 };
    formKit.placeControls(ctx, d.controls, theme);
    const jacks = formKit.jacksTop(d, w, { flip: ctx.flip });
    jacks.push({ key: 'ic0', dir: 'in', port: 'c0', label: 'EXP', side: ctx.flip ? 'right' : 'left', x: ctx.flip ? w + 2 : -2, y: 70, kind: 'ctrl' });
    return { w, h, theme, jacks };
  });
  const controls = [
    Object.assign(SCREEN('amb2-touch', { interactive: true }), { x: 96, y: 68, w: 168, h: 90, bezel: '#050505' }),
    Object.assign(K('_lvl', 'VOLUME', { virtual: true, min: -24, max: 12, def: 0, display: (x) => (x > 0 ? '+' : '') + x.toFixed(1) + ' dB' }), { x: 221, y: 38, r: 11, labelPos: 'below' }),
    Object.assign(K('kv', 'MENU / VALUE', { virtual: true, def: 0.5 }), { x: 221, y: 80, r: 13, labelPos: 'below' }),
    Object.assign(FOOT({ action: 'nav', nav: 'menu', style: 'plate', label: '', holdMs: 700 }), { x: 221, y: 80, w: 8, h: 8 }),
    Object.assign(FOOT({ action: 'nav', nav: 'lock', style: 'plate', label: '' }), { x: 221, y: 115, w: 32, h: 10 }),
    Object.assign(LED({ bind: 'fn', color: '#e8452c', ledFn: (ui, b) => (nav(b.id).lock ? '#e8452c' : null) }), { x: 242, y: 115, r: 1.6 }),
    ...[0, 1, 2].map((k) => Object.assign(K('k' + (k + 1), `SELECT ${k + 1}`, { virtual: true, def: 0.5 }), { x: 46 + k * 50, y: 134, r: 11, labelPos: 'below' })),
    ...[0, 1, 2].map((i) => Object.assign(FOOT({ action: 'nav', nav: 'fs' + i, style: 'stomp', label: '', holdMs: 1000 }), { x: 46 + i * 86, y: 198, r: 13 })),
    ...[0, 1, 2].map((i) => Object.assign(LED({ bind: 'fn', ledFn: (ui) => {
      if ((ui._fsm | 0) === 1) return i === 2 ? ((performance.now() / (60000 / (ui._bpm || 120))) % 1 < 0.15 ? '#ff6a3d' : null) : null;
      for (let k = 0; k < 12; k++) if (fsOf(ui, k) === i) { const x = amb.slot(ui, k); return x.m && x.on ? x.cat.color : null; }
      return null;
    } }), { x: 46 + i * 86, y: 177, r: 2.4 })),
  ];
  const initParams = Object.assign({}, amb.initParams, { _fsm: 0, _expT: 0, _lvl: 0, exp: 1 });
  for (const [k, f] of Object.entries(DEF_FS)) initParams[`_fa${k}`] = f;
  tz.addDefs([def({
    id: 'hotone.amb2', name: 'Ambera II Stomp', ref: 'Hotone Ampero II Stomp', brand: 'Hotone', code: 'AMB-II', logo: 'AMBERA II', typeName: 'Touchscreen amp modeler', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'hotone-amb2', color: '#26282c', stereo: 'stereo', ports: { ins: ['INPUT L (MONO)', 'INPUT R'], outs: ['OUTPUT L', 'OUTPUT R'] }, cost: 6, noBypassClick: true,
    ctrl: { ins: [{ label: 'EXP', param: 'exp' }] },
    algo: 'chain', opts: { chain: amb.chain }, derive: amb.derive, initParams, controls,
    desc: 'Compact touchscreen modeler with a 12-block grid (any block anywhere: dynamics, filters, drives, amps, cabs, EQ, mods, pitch, delays, reverbs, volume). Tap a block to select it (knobs SELECT 1-3 edit it), tap again to edit: drag sliders, the switch turns it on/off, FS assigns it to a footswitch, the name opens the model picker (category tabs + models). MENU/VALUE: press = edit / next parameter, hold = settings, turn = change the focused value (or browse blocks). Tap the top bar for the preset list. LOCK ignores screen touches. Footswitches: STOMP mode = assigned blocks; PRESET mode = preset ◀ ▶ and TAP; hold FS 3 to change mode. EXP jack: wah or volume.',
  })]);
  kit.register('hotone.amb2', amb);
}
