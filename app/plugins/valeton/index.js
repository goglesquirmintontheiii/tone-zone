// Built-in Tone Zone plugin: Valeton.
// valeton.gr200 – floor multi-effects inspired by the Valeton GP-200: 4.3" colour screen with an 11-module
// signal chain, dedicated amp knobs, three quick knobs, PAGE / ENTER / EXIT / SAVE / MENU buttons, a row of
// module buttons, eight footswitches (patch / stomp mode, bank, tap) and an expression pedal.
// Names, logos and artwork are Tone Zone originals; the layout follows the real unit (see `ref`).
import { makeKit, stdParts, stdLanes } from './mfx-kit.js';

export default function register(tz) {
  const { K, FOOT, LED, SCREEN, TREADLE, def } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;
  const kit = makeKit(tz);
  const { P, A, T, R, st, sa, fmt, nav } = kit;
  const S = stdParts(P);

  // ---------------------------------------------------------------- modules (fixed order, one category each)
  const CATS = [
    { key: 'PRE', name: 'PRE FX', color: '#f2cf3d' },
    { key: 'WAH', name: 'WAH', color: '#ff9b3d' },
    { key: 'DST', name: 'DISTORTION', color: '#ff5536' },
    { key: 'AMP', name: 'AMP', color: '#e8384f' },
    { key: 'NR', name: 'NOISE GATE', color: '#9aa3ad' },
    { key: 'CAB', name: 'CAB', color: '#c98b55' },
    { key: 'EQ', name: 'EQUALIZER', color: '#3fd0c0' },
    { key: 'MOD', name: 'MODULATION', color: '#3f9bff' },
    { key: 'DLY', name: 'DELAY', color: '#6fdc4f' },
    { key: 'RVB', name: 'REVERB', color: '#b088ff' },
    { key: 'VOL', name: 'VOLUME', color: '#d6dae0' },
  ];
  const v = {
    green: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 6, gainMaxDb: 40, tone: 'ts', toneLo: 723, postLp: 6500 },
    horse: { clip: 'si', cleanSum: true, cleanMix: 0.45, gainMinDb: 2, gainMaxDb: 34, tone: 'tilt', postLp: 9000 },
    supero: { clip: 'asym', gainMinDb: 6, gainMaxDb: 38, tone: 'lp', toneLo: 1200, toneHi: 7000, postLp: 7000 },
    mouse: { clip: 'si', gainMinDb: 12, gainMaxDb: 52, tone: 'rat', postLp: 7000 },
    pi: { clip: 'muff', stages: 2, stage2Db: 12, gainMinDb: 16, gainMaxDb: 50, tone: 'blend', postLp: 6000 },
    round: { clip: 'ge', gainMinDb: 14, gainMaxDb: 44, preHp: 40, tone: 'lp', postLp: 5000, bias: 0.3 },
    zone: { clip: 'si', stages: 2, stage2Db: 18, gainMinDb: 20, gainMaxDb: 60, preHp: 140, tone: 'eq3', postLp: 7500 },
    boost: { clip: 'clean', gainMinDb: 0, gainMaxDb: 20, tone: 'tilt' },
    bluesy: { clip: 'jfet', gainMinDb: 4, gainMaxDb: 30, tone: 'lp', toneLo: 1500, toneHi: 8000, postLp: 8000 },
  };
  const CABL = ['1x12us', '2x12twin', '4x10tweed', '2x12blue', '4x12gb', '4x12v30', '4x12t75', '4x12uber', '2x12cream', '1x12open', '4x12orange'];
  const LIB = [
    { name: 'Comp Studio', cat: 'PRE', ...S.comp('cmp') },
    { name: 'Comp Squash', cat: 'PRE', ...S.comp('cmpO') },
    { name: 'Micro Boost', cat: 'PRE', ...S.drv(v.boost), params: [P('GAIN', 'gain', 0.35), P('TONE', 'tone', 0.5), P('VOLUME', 'level', 0.5)] },
    { name: 'Octaver', cat: 'PRE', ...S.pitch(1 / 7, { mix: 0.55 }) },
    { name: 'V-Wah', cat: 'WAH', pedal: 'wah', ...S.wah(0) },
    { name: 'Auto Wah', cat: 'WAH', ...S.wah(2) },
    { name: 'Rez Filter', cat: 'WAH', ...S.wah(1, 0) },
    { name: 'Green OD', cat: 'DST', ...S.drv(v.green), params: [P('GAIN', 'gain', 0.45), P('TONE', 'tone', 0.5), P('VOLUME', 'level', 0.55)] },
    { name: 'Gold Horse', cat: 'DST', ...S.drv(v.horse), params: [P('GAIN', 'gain', 0.3), P('TREBLE', 'tone', 0.55), P('VOLUME', 'level', 0.55)] },
    { name: 'Super OD', cat: 'DST', ...S.drv(v.supero), params: [P('GAIN', 'gain', 0.45), P('TONE', 'tone', 0.5), P('VOLUME', 'level', 0.5)] },
    { name: 'Blues Drive', cat: 'DST', ...S.drv(v.bluesy), params: [P('GAIN', 'gain', 0.45), P('TONE', 'tone', 0.5), P('VOLUME', 'level', 0.5)] },
    { name: 'Mouse Dist', cat: 'DST', ...S.drv(v.mouse), params: [P('DIST', 'gain', 0.5), P('FILTER', 'tone', 0.45), P('VOLUME', 'level', 0.45)] },
    { name: 'Pi Fuzz', cat: 'DST', ...S.drv(v.pi), params: [P('SUSTAIN', 'gain', 0.55), P('TONE', 'tone', 0.5), P('VOLUME', 'level', 0.45)] },
    { name: 'Round Fuzz', cat: 'DST', ...S.drv(v.round), params: [P('FUZZ', 'gain', 0.6), P('TONE', 'tone', 0.6), P('VOLUME', 'level', 0.45)] },
    { name: 'Zone Metal', cat: 'DST', ...S.drv(v.zone), params: [P('GAIN', 'gain', 0.6), P('LOW', 'bass', 0.6), P('MID', 'mid', 0.4), P('HIGH', 'treble', 0.6), P('VOLUME', 'level', 0.4)] },
    { name: 'Tweedy', cat: 'AMP', ...S.amp('deluxe', { gain: 0.45 }) },
    { name: 'Bellman 59', cat: 'AMP', ...S.amp('bassman', { gain: 0.5 }) },
    { name: 'Dark Twin', cat: 'AMP', ...S.amp('twin', { gain: 0.3 }) },
    { name: 'Foxy 30', cat: 'AMP', ...S.amp('ac30', { gain: 0.45 }) },
    { name: 'Plexi 100', cat: 'AMP', ...S.amp('plexi', { gain: 0.55 }) },
    { name: 'UK Gold 800', cat: 'AMP', ...S.amp('jcm800', { gain: 0.55 }) },
    { name: 'Silver Jub', cat: 'AMP', ...S.amp('jubilee', { gain: 0.6 }) },
    { name: 'Brown Mod', cat: 'AMP', ...S.amp('friedman', { gain: 0.6 }) },
    { name: 'Dizzy Dual', cat: 'AMP', ...S.amp('recto', { gain: 0.6 }) },
    { name: 'Power 51', cat: 'AMP', ...S.amp('5150', { gain: 0.55 }) },
    { name: 'Juicy Or', cat: 'AMP', ...S.amp('orange', { gain: 0.55 }) },
    { name: 'Eagle 4V', cat: 'AMP', ...S.amp('vh4', { gain: 0.55 }) },
    { name: 'Gate 1', cat: 'NR', ...S.gate() },
    ...CABL.map((c) => ({ name: 'CAB ' + c.toUpperCase().replace(/^(\dX\d+)/, '$1 '), cat: 'CAB', ...S.cab(c) })),
    { name: 'Guitar EQ 1', cat: 'EQ', ...S.eq() },
    { name: 'Para EQ', cat: 'EQ', ...S.peq() },
    { name: 'A-Chorus', cat: 'MOD', ...S.chorus(0) },
    { name: 'B-Chorus', cat: 'MOD', ...S.chorus(3, { rate: 0.2 }) },
    { name: 'Tri Chorus', cat: 'MOD', ...S.chorus(2, { mix: 0.45 }) },
    { name: 'Vibrato', cat: 'MOD', ...S.chorus(1, { mix: 1 }) },
    { name: 'Jet', cat: 'MOD', ...S.flanger(0) },
    { name: 'Phaser', cat: 'MOD', ...S.phaser(4) },
    { name: 'Tremolo', cat: 'MOD', ...S.trem(0) },
    { name: 'Vibe', cat: 'MOD', ...S.vibe() },
    { name: 'Rotary', cat: 'MOD', ...S.rotary() },
    { name: 'Pitch Shift', cat: 'MOD', ...S.pitch(6 / 7, { mix: 0.4 }) },
    { name: 'Pure', cat: 'DLY', ...S.dly(0) },
    { name: 'Analog', cat: 'DLY', ...S.dly(1, [P('TONE', 'tone', 0.4)]) },
    { name: 'Slapback', cat: 'DLY', ...S.dly(1, [P('TONE', 'tone', 0.5)]), params: [P('TIME', 'time', 0.12, { min: 20, max: 2000, curve: 'log', fmt: 'ms', tap: false }), P('F.BACK', 'feedback', 0.1, { max: 0.95 }), P('MIX', 'mix', 0.35)] },
    { name: 'Tape', cat: 'DLY', ...S.dly(2, [P('WOW', 'moddepth', 0.25), P('AGE', 'age', 0.35)]) },
    { name: 'Sweep', cat: 'DLY', ...S.dly(4, [P('RATE', 'modrate', 0.3), P('DEPTH', 'moddepth', 0.4)]) },
    { name: 'Ping Pong', cat: 'DLY', ...S.dly(7, [P('SPREAD', 'spread', 0.8)]) },
    { name: 'Reverse', cat: 'DLY', ...S.dly(5) },
    { name: 'Air', cat: 'RVB', ...S.rev(0) },
    { name: 'Hall', cat: 'RVB', ...S.rev(1) },
    { name: 'Plate', cat: 'RVB', ...S.rev(2) },
    { name: 'Spring', cat: 'RVB', ...S.rev(3) },
    { name: 'Sweet Space', cat: 'RVB', ...S.rev(6, [P('MOD', 'mod', 0.5)]) },
    { name: 'N-Star', cat: 'RVB', ...S.rev(4, [P('SHIMMER', 'shimmer', 0.5)]) },
    { name: 'Deep Sea', cat: 'RVB', ...S.rev(5) },
    { name: 'Volume', cat: 'VOL', pedal: 'vol', ...S.vol() },
  ];
  const gr = kit.unit({
    id: 'valeton.gr200', slots: 11, knobs: 3, cats: CATS, models: LIB, exp: true, memPrefix: 'PATCH',
    slotCats: CATS.map((c) => [c.key]),
    lanes: stdLanes({ drv: 2, dly: 1 }),
    patch: [['Comp Studio', false], ['V-Wah', false], ['Gold Horse', true], ['UK Gold 800', true, { GAIN: 0.5 }], ['Gate 1', true, { THRESH: 0.25 }], ['CAB 4X12 GB', true], ['Guitar EQ 1', false], ['A-Chorus', false], ['Analog', true, { MIX: 0.22 }], ['Hall', true, { MIX: 0.22 }], ['Volume', true]],
    mems: [
      { name: 'GOLD CRUNCH' },
      { name: 'SPARKLE', patch: [['Comp Studio', true], ['V-Wah', false], ['Micro Boost', false], ['Dark Twin', true], ['Gate 1', false], ['CAB 2X12 TWIN', true], ['Guitar EQ 1', false], ['Tri Chorus', true], ['Pure', true, { MIX: 0.2 }], ['Plate', true, { MIX: 0.3 }], ['Volume', true]] },
      { name: 'DUAL LEAD', patch: [['Micro Boost', false], ['V-Wah', false], ['Green OD', true, { GAIN: 0.2, VOLUME: 0.7 }], ['Dizzy Dual', true], ['Gate 1', true, { THRESH: 0.4 }], ['CAB 4X12 V30', true], ['Para EQ', false], ['Phaser', false], ['Analog', true, { MIX: 0.25 }], ['Air', true, { MIX: 0.18 }], ['Volume', true]] },
      { name: 'DEEP SPACE', patch: [['Comp Squash', true], ['Auto Wah', false], ['Blues Drive', false], ['Foxy 30', true, { GAIN: 0.35 }], ['Gate 1', false], ['CAB 2X12 BLUE', true], ['Guitar EQ 1', false], ['B-Chorus', true], ['Sweep', true, { MIX: 0.35, 'F.B': 0.5 }], ['N-Star', true, { MIX: 0.45, DECAY: 0.75 }], ['Volume', true]] },
    ],
  });

  // ---------------------------------------------------------------- screen (charcoal UI, orange cursor, Verdana)
  const C = { bg: '#141619', hdr: '#22262c', panel: '#1c1f24', acc: '#ff8a1f', ink: '#f3f3f3', dim: '#8d939c', line: '#30353c' };
  const VF = "Verdana, 'DejaVu Sans', 'Bitstream Vera Sans', sans-serif";
  const NM = 16; // patch memories (4 banks x A-D)
  const pname = (m) => `${String(Math.floor(m / 4) + 1).padStart(2, '0')}-${'ABCD'[m % 4]}`;
  const EXPN = ['AUTO', 'VOLUME', 'WAH', 'OFF'];
  const MENU = [
    { label: 'FOOTSWITCH MODE', get: (ui) => ['PATCH', 'STOMP'][ui._fsm | 0], step: (blk, ui) => tz.app.setParam(blk.id, '_fsm', (ui._fsm | 0) ? 0 : 1) },
    { label: 'STOMP ASSIGN', get: () => 'A B C D  ›', sub: 'assign' },
    { label: 'EXP PEDAL', get: (ui) => EXPN[ui._expT ?? 0], step: (blk, ui, d) => tz.app.setParam(blk.id, '_expT', ((ui._expT ?? 0) + d + 4) % 4) },
    { label: 'TEMPO', get: (ui) => `${ui._bpm || 120} BPM`, step: (blk, ui, d) => A.setBpm(blk, (ui._bpm || 120) + d) },
    { label: 'OUTPUT LEVEL', get: (ui) => `${(ui._lvl ?? 0) > 0 ? '+' : ''}${(ui._lvl ?? 0).toFixed(1)} dB`, step: (blk, ui, d) => tz.app.setParam(blk.id, '_lvl', Math.max(-24, Math.min(12, (ui._lvl ?? 0) + d * 0.5))) },
    { label: 'INIT PATCH', get: () => 'ENTER', act: (blk) => { A.init(blk); tz.ui.toast('Patch initialised', 'ok', 1000); } },
  ];
  const DEF_ASSIGN = [2, 7, 8, 9];
  const assignOf = (ui, i) => ui[`_fa${i}`] ?? DEF_ASSIGN[i];

  tz.addScreen('gr200-lcd', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      R(g, 0, 0, w, h, { fill: C.bg });
      // header (shared by all views)
      R(g, 0, 0, w, 14, { fill: C.hdr });
      s.hBox = R(g, 2, 2, 27, 10, { rx: 2, fill: C.acc });
      s.hNum = T(g, 15.5, 7.3, '', { size: 5.6, fill: '#1a0d00', font: VF, weight: 700 });
      s.hName = T(g, 33, 7.3, '', { anchor: 'start', size: 5.6, fill: C.ink, font: VF, weight: 700 });
      s.hRight = T(g, w - 3, 7.3, '', { anchor: 'end', size: 4, fill: C.dim, font: VF });
      const V = (n) => (s[n] = svg('g', {}, g));
      // ---- HOME: 11-module chain
      V('vHome');
      svg('line', { x1: 6, x2: w - 6, y1: 29, y2: 29, stroke: C.line, 'stroke-width': 1 }, s.vHome);
      const iw = (w - 8) / 11;
      s.icons = CATS.map((c, i) => {
        const x = 4 + i * iw;
        const bg = R(s.vHome, x + 1, 22.5, iw - 2, 13, { rx: 2.5, fill: '#2a2e33', stroke: c.color, 'stroke-width': 0.7 });
        const t = T(s.vHome, x + iw / 2, 29.2, c.key, { size: 3.5, fill: C.ink, font: VF, weight: 700 });
        return { x, w: iw, bg, t };
      });
      s.cur = svg('path', { d: '', fill: C.acc }, s.vHome);
      s.hMod = T(s.vHome, 6, 47, '', { anchor: 'start', size: 4, fill: C.dim, font: VF, ls: 0.4 });
      s.hModel = T(s.vHome, 6, 56.5, '', { anchor: 'start', size: 8.6, fill: C.ink, font: VF, weight: 700 });
      s.hOnBg = R(s.vHome, w - 30, 46, 27, 10, { rx: 5, fill: '#2a2e33' });
      s.hOn = T(s.vHome, w - 16.5, 51.3, '', { size: 4.6, fill: '#fff', font: VF, weight: 700 });
      s.q = [0, 1, 2].map((k) => {
        const cw = (w - 8) / 3, x = 4 + k * cw;
        R(s.vHome, x + 0.5, 66, cw - 1, 30, { rx: 2.5, fill: C.panel, stroke: C.line, 'stroke-width': 0.5 });
        svg('circle', { cx: x + 7, cy: 72, r: 3, fill: 'none', stroke: C.acc, 'stroke-width': 0.6 }, s.vHome);
        T(s.vHome, x + 7, 72.2, String(k + 1), { size: 3.4, fill: C.acc, font: VF, weight: 700 });
        const l = T(s.vHome, x + 13, 72.2, '', { anchor: 'start', size: 3.8, fill: C.dim, font: VF });
        const val = T(s.vHome, x + cw / 2, 83, '', { size: 7, fill: C.ink, font: VF, weight: 700 });
        R(s.vHome, x + 4, 90, cw - 9, 2, { rx: 1, fill: '#2a2e33' });
        const bar = R(s.vHome, x + 4, 90, 0, 2, { rx: 1, fill: C.acc });
        return { l, val, bar, bw: cw - 9 };
      });
      // ---- EDIT: module + model + parameter list
      V('vEdit');
      s.eTag = R(s.vEdit, 3, 17, 22, 10, { rx: 2, fill: '#555' });
      s.eTagT = T(s.vEdit, 14, 22.3, '', { size: 4.4, fill: '#111', font: VF, weight: 700 });
      s.eL = T(s.vEdit, 31, 22.3, '◀', { size: 5, fill: C.acc, font: VF });
      s.eModel = T(s.vEdit, 82, 22.3, '', { size: 6.4, fill: C.ink, font: VF, weight: 700 });
      s.eR = T(s.vEdit, 133, 22.3, '▶', { size: 5, fill: C.acc, font: VF });
      s.eOnBg = R(s.vEdit, w - 32, 17, 29, 10, { rx: 5, fill: '#2a2e33' });
      s.eOn = T(s.vEdit, w - 17.5, 22.3, '', { size: 4.4, fill: '#fff', font: VF, weight: 700 });
      s.prow = [];
      for (let r = 0; r < 6; r++) {
        const y = 31 + r * 11;
        const bg = R(s.vEdit, 2, y, w - 4, 10, { rx: 1.5, fill: 'none' });
        const kn = T(s.vEdit, 7, y + 5.2, '', { size: 3.6, fill: C.acc, font: VF, weight: 700 });
        const l = T(s.vEdit, 13, y + 5.2, '', { anchor: 'start', size: 4.2, fill: C.ink, font: VF });
        R(s.vEdit, 58, y + 4, 82, 2.2, { rx: 1.1, fill: '#2a2e33' });
        const bar = R(s.vEdit, 58, y + 4, 0, 2.2, { rx: 1.1, fill: C.acc });
        const val = T(s.vEdit, w - 4, y + 5.2, '', { anchor: 'end', size: 4.2, fill: C.ink, font: VF, weight: 700 });
        s.prow.push({ y, bg, kn, l, bar, val });
      }
      // ---- LIST: models of the module
      V('vList');
      s.lTitle = T(s.vList, 5, 21.5, '', { anchor: 'start', size: 4.6, fill: C.acc, font: VF, weight: 700, ls: 0.4 });
      s.lrow = [];
      for (let r = 0; r < 6; r++) {
        const y = 27 + r * 11.4;
        const bg = R(s.vList, 2, y, w - 9, 10.4, { rx: 1.5, fill: 'none' });
        const t = T(s.vList, 8, y + 5.4, '', { anchor: 'start', size: 5.4, fill: C.ink, font: VF });
        const ck = T(s.vList, w - 12, y + 5.4, '', { anchor: 'end', size: 5, fill: C.acc, font: VF, weight: 700 });
        s.lrow.push({ y, bg, t, ck });
      }
      s.lsb = R(s.vList, w - 5, 27, 2.4, 20, { rx: 1.2, fill: '#3a4048' });
      // ---- MENU / ASSIGN (shared row layout)
      V('vMenu');
      s.mTitle = T(s.vMenu, 5, 21.5, '', { anchor: 'start', size: 4.6, fill: C.acc, font: VF, weight: 700, ls: 0.4 });
      s.mrow = [];
      for (let r = 0; r < 6; r++) {
        const y = 27 + r * 11.4;
        const bg = R(s.vMenu, 2, y, w - 4, 10.4, { rx: 1.5, fill: 'none' });
        const l = T(s.vMenu, 7, y + 5.4, '', { anchor: 'start', size: 4.8, fill: C.ink, font: VF });
        const val = T(s.vMenu, w - 6, y + 5.4, '', { anchor: 'end', size: 4.8, fill: C.dim, font: VF, weight: 700 });
        s.mrow.push({ y, bg, l, val });
      }
      // ---- SAVE dialog
      V('vSave');
      R(s.vSave, 18, 26, w - 36, 60, { rx: 4, fill: C.panel, stroke: C.acc, 'stroke-width': 0.8 });
      T(s.vSave, w / 2, 35, 'SAVE PATCH TO', { size: 4.6, fill: C.dim, font: VF, weight: 700, ls: 0.6 });
      s.sTo = T(s.vSave, w / 2, 51, '', { size: 12, fill: C.acc, font: VF, weight: 700 });
      s.sName = T(s.vSave, w / 2, 63, '', { size: 4.8, fill: C.ink, font: VF });
      T(s.vSave, w / 2, 78, '◀ ▶ SELECT · SAVE / ENTER = OK · EXIT', { size: 3.4, fill: C.dim, font: VF });
      s.views = ['vHome', 'vEdit', 'vList', 'vMenu', 'vSave'];
      s.sig = '';
    },
    update(s, status, view, now) {
      const blk = view.block, ui = s.ui, n = nav(blk.id), w = s.w;
      let sig = `${n.view}|${n.t}|${n.sel}|${n.page}|${n.li}|${n.top}|${n.edit ? 1 : 0}|${n.saveTo}|${ui._cur}|${ui._fsm}|${ui._bpm}|${ui._expT}|${ui._lvl}`;
      for (let i = 0; i < 11; i++) sig += `|${ui['_m' + i]}${ui['_o' + i]}`;
      for (let k = 0; k < 8; k++) sig += `|${(ui[`_p${n.sel}_${k}`] ?? 0).toFixed(3)}`;
      for (let i = 0; i < 4; i++) sig += `|${ui['_fa' + i]}`;
      if (sig === s.sig) return;
      s.sig = sig;
      const vn = { home: 'vHome', edit: 'vEdit', list: 'vList', menu: 'vMenu', assign: 'vMenu', save: 'vSave' }[n.view] || 'vHome';
      if (s.curV !== vn) { for (const k of s.views) sa(s[k], 'display', k === vn || (vn === 'vSave' && k === 'vHome') ? 'inline' : 'none'); s.curV = vn; }
      const cur = ui._cur | 0;
      st(s.hNum, pname(cur));
      st(s.hName, A.memName(blk, cur));
      st(s.hRight, `${(ui._fsm | 0) ? 'STOMP' : 'PATCH'} · ${ui._bpm || 120}BPM`);
      const Al = gr.alloc(ui);
      const x = gr.slot(ui, n.sel, Al);
      if (vn === 'vHome' || vn === 'vSave') {
        s.icons.forEach((ic, i) => {
          const y = gr.slot(ui, i, Al);
          const c = CATS[i].color;
          sa(ic.bg, 'fill', y.m && y.on ? c : '#2a2e33');
          sa(ic.t, 'fill', y.m && y.on ? '#111' : y.m ? C.ink : '#555b63');
          sa(ic.bg, 'stroke-width', i === n.sel ? 1.4 : 0.7);
          sa(ic.bg, 'stroke', i === n.sel ? '#ffffff' : c);
        });
        const ic = s.icons[n.sel];
        const cx = ic.x + ic.w / 2;
        sa(s.cur, 'd', `M${cx - 3} 41 L${cx + 3} 41 L${cx} 37.5 Z`);
        st(s.hMod, `${CATS[n.sel].name}${x.over ? ' · DSP FULL' : ''}`);
        st(s.hModel, x.m ? x.m.name : 'NONE');
        sa(s.hOnBg, 'fill', x.on ? CATS[n.sel].color : '#2a2e33');
        st(s.hOn, x.m ? (x.on ? 'ON' : 'OFF') : '—');
        sa(s.hOn, 'fill', x.on ? '#111' : '#fff');
        s.q.forEach((q, k) => {
          const p = x.m && x.m.params[n.page * 3 + k];
          st(q.l, p ? p.label : '');
          st(q.val, p ? fmt(p, x.val(n.page * 3 + k)) : '');
          sa(q.bar, 'width', p ? (x.val(n.page * 3 + k) * q.bw).toFixed(1) : 0);
        });
        if (vn === 'vSave') {
          const to = n.saveTo ?? cur;
          st(s.sTo, pname(to));
          st(s.sName, A.memName(blk, to));
        }
      } else if (vn === 'vEdit') {
        const c = CATS[n.sel];
        sa(s.eTag, 'fill', c.color);
        st(s.eTagT, c.key);
        st(s.eModel, x.m ? x.m.name : 'NONE');
        sa(s.eOnBg, 'fill', x.on ? c.color : '#2a2e33');
        st(s.eOn, x.m ? (x.on ? 'ON' : 'OFF') : '—');
        sa(s.eOn, 'fill', x.on ? '#111' : '#fff');
        const ps = x.m ? x.m.params : [];
        const off = Math.floor((n.page * 3) / 6) * 6;
        s.prow.forEach((r, j) => {
          const k = off + j, p = ps[k];
          const live = p && Math.floor(k / 3) === n.page;
          sa(r.bg, 'fill', live ? '#262a31' : 'none');
          st(r.kn, live ? String((k % 3) + 1) : '');
          st(r.l, p ? p.label : '');
          st(r.val, p ? fmt(p, x.val(k)) : '');
          sa(r.bar, 'width', p ? (x.val(k) * 82).toFixed(1) : 0);
          sa(r.bar, 'fill', live ? C.acc : '#6b7079');
        });
      } else if (vn === 'vList') {
        const list = gr.inCat(CATS[n.sel].key);
        st(s.lTitle, `${CATS[n.sel].name} › SELECT MODEL`);
        s.lrow.forEach((r, j) => {
          const m = list[n.top + j];
          const hl = n.top + j === n.li;
          st(r.t, m ? m.name : '');
          st(r.ck, m && x.m && m.idx === x.m.idx ? '●' : '');
          sa(r.bg, 'fill', m && hl ? C.acc : 'none');
          sa(r.t, 'fill', hl ? '#1a0d00' : C.ink);
          sa(r.t, 'font-weight', hl ? 700 : 400);
        });
        const tot = Math.max(1, list.length);
        sa(s.lsb, 'height', (Math.min(1, 6 / tot) * 68).toFixed(1));
        sa(s.lsb, 'y', (27 + (n.top / tot) * 68).toFixed(1));
      } else {
        const asg = n.view === 'assign';
        st(s.mTitle, asg ? 'MENU › STOMP ASSIGN' : 'MENU');
        s.mrow.forEach((r, j) => {
          const it = asg ? (j < 4 ? { label: `FOOTSWITCH ${'ABCD'[j]}`, get: () => CATS[assignOf(ui, j)].name } : null) : MENU[j];
          const hl = j === n.li;
          st(r.l, it ? it.label : '');
          st(r.val, it ? (hl && n.edit ? `◀ ${it.get(ui)} ▶` : it.get(ui)) : '');
          sa(r.bg, 'fill', it && hl ? (n.edit ? C.acc : '#2c3138') : 'none');
          sa(r.l, 'fill', it && hl && n.edit ? '#1a0d00' : C.ink);
          sa(r.val, 'fill', it && hl && n.edit ? '#1a0d00' : hl ? C.acc : C.dim);
        });
      }
    },
    pointer(s, view, type, pt, e, editor) {
      const blk = view.block, n = nav(blk.id), ui = tz.app.ui(blk), w = s.w;
      if (type === 'wheel') { nav2(blk, e.deltaY > 0 ? 'right' : 'left', pt); return; }
      if (type === 'move' && s.drag) {
        const v0 = s.drag.v0 + (pt.x - s.drag.x0) / 82 * (e.shiftKey ? 0.25 : 1);
        A.setVal(blk, n.sel, s.drag.k, v0);
        return;
      }
      if (type === 'up') { s.drag = null; return; }
      if (type !== 'down') return;
      s.sig = '';
      if (pt.y < 14) { if (pt.x < 30) A.view(blk, 'save'), (n.saveTo = ui._cur | 0); else A.view(blk, n.view === 'menu' ? 'home' : 'menu'); return; }
      switch (n.view) {
        case 'home': {
          const i = s.icons.findIndex((ic) => pt.x >= ic.x && pt.x < ic.x + ic.w);
          if (pt.y < 44 && i >= 0) { if (i === n.sel) A.view(blk, 'edit'); else A.select(blk, i); return; }
          if (pt.y < 62) { if (pt.x > w - 32) A.toggle(blk, n.sel); else A.view(blk, 'edit'); return; }
          A.page(blk, 1);
          return;
        }
        case 'edit': {
          if (pt.y < 29) {
            if (pt.x < 27) A.view(blk, 'home');
            else if (pt.x < 40) A.stepModel(blk, n.sel, -1);
            else if (pt.x > 126 && pt.x < 140) A.stepModel(blk, n.sel, 1);
            else if (pt.x >= w - 32) A.toggle(blk, n.sel);
            else openList(blk);
            return;
          }
          const j = Math.floor((pt.y - 31) / 11);
          const off = Math.floor((n.page * 3) / 6) * 6;
          const k = off + j;
          const x = gr.slot(ui, n.sel);
          if (x.m && x.m.params[k]) {
            if (Math.floor(k / 3) !== n.page) { n.page = Math.floor(k / 3); kit.syncKnobs(blk); kit.bump(blk); }
            s.drag = { k, v0: x.val(k), x0: pt.x };
          }
          return;
        }
        case 'list': {
          const j = Math.floor((pt.y - 27) / 11.4);
          const list = gr.inCat(CATS[n.sel].key);
          const m = list[n.top + j];
          if (m) { A.setModel(blk, n.sel, m.idx); A.view(blk, 'edit'); }
          return;
        }
        case 'menu':
        case 'assign': {
          const j = Math.floor((pt.y - 27) / 11.4);
          const nRows = n.view === 'assign' ? 4 : MENU.length;
          if (j < 0 || j >= nRows) return;
          if (n.li === j && pt.x > w * 0.55) { n.edit = true; nav2(blk, 'right'); return; }
          n.li = j; n.edit = false;
          nav2(blk, 'enter');
          return;
        }
        case 'save': nav2(blk, pt.x < w / 2 ? 'left' : 'right'); return;
      }
    },
  });
  function openList(blk) {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    const list = gr.inCat(CATS[n.sel].key);
    A.view(blk, 'list');
    n.li = Math.max(0, list.findIndex((m) => m.idx === (ui[`_m${n.sel}`] ?? -1)));
    n.top = Math.max(0, Math.min(Math.max(0, list.length - 6), n.li - 2));
  }
  // one navigation entry point for buttons, wheel and taps
  function nav2(blk, key) {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    const d = key === 'left' ? -1 : key === 'right' ? 1 : 0;
    switch (n.view) {
      case 'home':
        if (d) A.selMove(blk, d);
        else if (key === 'enter') A.view(blk, 'edit');
        break;
      case 'edit':
        if (d) A.page(blk, d);
        else if (key === 'enter') openList(blk);
        else if (key === 'exit') A.view(blk, 'home');
        break;
      case 'list': {
        const list = gr.inCat(CATS[n.sel].key);
        if (d) { n.li = Math.max(0, Math.min(list.length - 1, n.li + d)); n.top = Math.max(0, Math.min(n.li, Math.max(n.top, n.li - 5))); kit.bump(blk); }
        else if (key === 'enter' && list[n.li]) { A.setModel(blk, n.sel, list[n.li].idx); A.view(blk, 'edit'); }
        else if (key === 'exit') A.view(blk, 'edit');
        break;
      }
      case 'menu': {
        const it = MENU[n.li];
        if (n.edit) {
          if (d && it.step) it.step(blk, ui, d);
          else if (key === 'enter' || key === 'exit') n.edit = false;
        } else if (d) n.li = (n.li + d + MENU.length) % MENU.length;
        else if (key === 'enter') {
          if (it.sub) { A.view(blk, it.sub); n.li = 0; n.edit = false; }
          else if (it.act) it.act(blk);
          else n.edit = true;
        } else if (key === 'exit') A.view(blk, 'home');
        kit.bump(blk);
        break;
      }
      case 'assign':
        if (n.edit) {
          if (d) tz.app.setParam(blk.id, `_fa${n.li}`, (assignOf(ui, n.li) + d + CATS.length) % CATS.length);
          else n.edit = false;
        } else if (d) n.li = (n.li + d + 4) % 4;
        else if (key === 'enter') n.edit = true;
        else if (key === 'exit') { A.view(blk, 'menu'); n.li = 1; }
        kit.bump(blk);
        break;
      case 'save':
        if (d) n.saveTo = (((n.saveTo ?? ui._cur) | 0) + d + NM) % NM;
        else if (key === 'enter' || key === 'save') { A.store(blk, n.saveTo ?? (ui._cur | 0)); A.view(blk, 'home'); }
        else if (key === 'exit') A.view(blk, 'home');
        kit.bump(blk);
        break;
    }
    if (key === 'exit' && n.view === 'home') kit.bump(blk);
  }

  kit.hooks('valeton.gr200', (blk, name, ctl, phase) => {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    if (name === 'tap') { if (phase === 'down') A.tap(blk); return; }
    if (name.startsWith('mb')) {
      if (phase !== 'press') return;
      const i = +name.slice(2);
      if (n.sel === i && (n.view === 'edit' || n.view === 'home')) A.toggle(blk, i);
      else { A.select(blk, i); A.view(blk, 'edit'); }
      return;
    }
    if (['left', 'right', 'enter', 'exit', 'save', 'menu'].includes(name)) {
      if (phase !== 'press') return;
      if (name === 'menu') { A.view(blk, n.view === 'menu' ? 'home' : 'menu'); n.edit = false; return; }
      if (name === 'save' && n.view !== 'save') { A.view(blk, 'save'); n.saveTo = ui._cur | 0; return; }
      nav2(blk, name);
      return;
    }
    if (phase !== 'press' && !(name.startsWith('fs') && phase === 'hold')) return;
    if (name === 'bank') { n.bank = (((n.bank ?? Math.floor((ui._cur | 0) / 4)) + ctl.dir + 4) % 4); kit.bump(blk); tz.ui.toast(`BANK ${String(n.bank + 1).padStart(2, '0')}`, 'info', 700); return; }
    if (name === 'mode') { tz.app.setParam(blk.id, '_fsm', (ui._fsm | 0) ? 0 : 1); kit.bump(blk); return; }
    if (name.startsWith('fs')) {
      const i = +name.slice(2);
      if ((ui._fsm | 0) === 1) { if (phase === 'press') A.toggle(blk, assignOf(ui, i)); return; }
      const m = (n.bank ?? Math.floor((ui._cur | 0) / 4)) * 4 + i;
      if (phase === 'hold') A.store(blk, m);
      else A.recall(blk, m);
    }
  });

  // ---------------------------------------------------------------- enclosure
  tz.addForm('valeton-gr200', (ctx, d) => {
    const g = ctx.g, w = 540, h = 300;
    formKit.body(g, w, h, d.color, { rx: 10 });
    svg('rect', { x: 8, y: 8, width: 446, height: 148, rx: 6, fill: '#202225', stroke: '#000', 'stroke-opacity': 0.6 }, g);
    svg('rect', { x: 8, y: 160, width: 446, height: 132, rx: 6, fill: '#121315', stroke: '#000', 'stroke-opacity': 0.6 }, g);
    // raised back row of switches (taller rocker deck)
    svg('rect', { x: 14, y: 166, width: 434, height: 56, rx: 5, fill: '#1a1b1e' }, g);
    svg('rect', { x: 462, y: 8, width: 70, height: 284, rx: 8, fill: '#0b0c0d', stroke: '#000' }, g);
    const txt = '#e3e5e8', dim = '#8d939c';
    label(g, 316, 14.5, 'AMP', { size: 4.4, fill: '#ff8a1f', weight: 800, ls: 1.6 });
    label(g, 272, 66, 'QUICK ACCESS', { size: 4.2, fill: dim, weight: 800, ls: 1.2 });
    // button caps
    const cap = (x, y, t, ww = 30) => {
      svg('rect', { x: x - ww / 2 - 0.5, y: y - 5, width: ww + 1, height: 11, rx: 2.5, fill: '#000', opacity: 0.6 }, g);
      svg('rect', { x: x - ww / 2, y: y - 5.5, width: ww, height: 10, rx: 2.5, fill: '#34373c', stroke: '#0c0c0c', 'stroke-width': 0.5 }, g);
      label(g, x, y - 0.4, t, { size: 4.2, fill: txt, weight: 800, ls: 0.3 });
    };
    cap(372, 80, '◀'); cap(414, 80, '▶'); cap(372, 100, 'EXIT'); cap(414, 100, 'ENTER'); cap(372, 120, 'SAVE'); cap(414, 120, 'MENU');
    label(g, 393, 70, 'PAGE', { size: 4.2, fill: dim, weight: 800, ls: 1.2 });
    CATS.forEach((c, i) => cap(28 + i * 39.6, 142, c.key, 28));
    // logo
    label(g, 231, 258, 'GR-200', { size: 12, fill: '#fff', font: "Verdana, 'DejaVu Sans', sans-serif", weight: 700, ls: 1.2 });
    label(g, 231, 270, 'GRAPHITE PRO', { size: 4.4, fill: '#ff8a1f', weight: 800, ls: 1.6 });
    // footswitch labels
    ['▼ BANK', 'BANK ▲', 'MODE', 'TAP'].forEach((t, i) => label(g, 66 + i * 110, 216, t, { size: 4.8, fill: dim, weight: 800, ls: 0.8 }));
    ['A', 'B', 'C', 'D'].forEach((t, i) => label(g, 66 + i * 110, 284, t, { size: 6.4, fill: txt, weight: 800 }));
    label(g, 497, 284, 'EXP', { size: 5, fill: dim, weight: 800, ls: 1 });
    formKit.tzBadge(g, 341, 284, '#5d636b', 3.8);
    const theme = { text: txt, knob: 'boss', labelSize: 4.8 };
    formKit.placeControls(ctx, d.controls, theme);
    const jacks = formKit.jacksTop(d, w, { flip: ctx.flip });
    jacks.push({ key: 'ic0', dir: 'in', port: 'c0', label: 'EXP 2', side: 'top', x: ctx.flip ? w * 0.68 : w * 0.32, y: -2, kind: 'ctrl' });
    return { w, h, theme, jacks };
  });

  const fsLed = (i, back) => (ui, b) => {
    if (back) return i === 3 ? ((performance.now() / (60000 / (ui._bpm || 120))) % 1 < 0.15 ? '#ff8a1f' : null) : i === 2 ? ((ui._fsm | 0) ? '#3f9bff' : '#ff8a1f') : null;
    if ((ui._fsm | 0) === 1) { const mi = assignOf(ui, i); const x = gr.slot(ui, mi); return x.m && x.on ? CATS[mi].color : null; }
    const n = nav(b.id);
    return (ui._cur | 0) === (n.bank ?? Math.floor((ui._cur | 0) / 4)) * 4 + i ? '#ff8a1f' : null;
  };
  const controls = [
    Object.assign(SCREEN('gr200-lcd', { interactive: true }), { x: 112, y: 66, w: 180, h: 101, bezel: '#050505' }),
    ...['GAIN', 'BASS', 'MIDDLE', 'TREBLE', 'VOLUME'].map((l, k) => Object.assign(K(`_p3_${[0, 1, 2, 3, 5][k]}`, l, { virtual: true, def: [0.5, 0.5, 0.5, 0.55, 0.55][k] }), { x: 236 + k * 44, y: 34, r: 11, labelPos: 'below' })),
    ...[0, 1, 2].map((k) => Object.assign(K('k' + (k + 1), String(k + 1), { virtual: true, def: 0.5 }), { x: 236 + k * 36, y: 96, r: 11, labelPos: 'below' })),
    ...[['left', 372, 80], ['right', 414, 80], ['exit', 372, 100], ['enter', 414, 100], ['save', 372, 120], ['menu', 414, 120]].map(([nm, x, y]) => Object.assign(FOOT({ action: 'nav', nav: nm, style: 'plate', label: '' }), { x, y, w: 30, h: 10 })),
    ...CATS.map((c, i) => Object.assign(FOOT({ action: 'nav', nav: 'mb' + i, style: 'plate', label: '' }), { x: 28 + i * 39.6, y: 142, w: 28, h: 10 })),
    ...CATS.map((c, i) => Object.assign(LED({ bind: 'fn', color: c.color, ledFn: (ui) => { const x = gr.slot(ui, i); return x.m && x.on ? c.color : null; } }), { x: 28 + i * 39.6, y: 132.5, r: 1.5 })),
    ...[0, 1, 2, 3].map((i) => Object.assign(FOOT({ action: 'nav', nav: ['bank', 'bank', 'mode', 'tap'][i], dir: [-1, 1, 0, 0][i], style: 'stomp', label: '' }), { x: 66 + i * 110, y: 194, r: 12 })),
    ...[0, 1, 2, 3].map((i) => Object.assign(LED({ bind: 'fn', ledFn: fsLed(i, true) }), { x: 88 + i * 110, y: 194, r: 2.4 })),
    ...[0, 1, 2, 3].map((i) => Object.assign(FOOT({ action: 'nav', nav: 'fs' + i, style: 'stomp', label: '', holdMs: 900 }), { x: 66 + i * 110, y: 258, r: 14 })),
    ...[0, 1, 2, 3].map((i) => Object.assign(LED({ bind: 'fn', ledFn: fsLed(i, false) }), { x: 66 + i * 110, y: 234, r: 2.6 })),
    Object.assign(TREADLE('exp', { virtual: true, def: 1, color: '#18191b' }), { x: 497, y: 142, w: 56, h: 236 }),
  ];
  tz.addDefs([def({
    id: 'valeton.gr200', name: 'GR-200 Graphite Pro', ref: 'Valeton GP-200', brand: 'Valeton', code: 'GR-200', logo: 'GR-200', typeName: 'Multi-effects processor', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'valeton-gr200', color: '#17181a', stereo: 'stereo', ports: { ins: ['INPUT'], outs: ['OUTPUT L', 'OUTPUT R'] }, cost: 6.5, noBypassClick: true,
    ctrl: { ins: [{ label: 'EXP 2', param: 'exp' }] },
    algo: 'chain', opts: { chain: gr.chain }, derive: gr.derive,
    initParams: Object.assign({}, gr.initParams, { _fsm: 0, _expT: 0, _lvl: 0, exp: 1 }),
    controls,
    desc: 'Floor processor with 11 fixed modules (PRE · WAH · DST · AMP · NR · CAB · EQ · MOD · DLY · RVB · VOL). ◀ ▶ move the cursor along the chain, ENTER edits a module (◀ ▶ = parameter pages for quick knobs 1-3), ENTER again opens its model list, EXIT goes back. The module buttons jump to a module (press again to switch it on/off). AMP knobs always control the amp module. MENU: footswitch mode, stomp assign (A-D), expression pedal target, tempo, output level, init patch. SAVE stores the patch (◀ ▶ picks the location). Footswitches: PATCH mode = A-D recall patches of the bank (hold to store), STOMP mode = A-D switch the assigned modules; BANK ▼▲, MODE, TAP. Touch: tap modules, model arrows, rows (drag to edit).',
  })]);
  kit.register('valeton.gr200', gr);
}
