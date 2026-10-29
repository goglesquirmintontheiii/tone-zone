// "VX Stomp XL" - inspired by the Line 6 HX Stomp XL.
// Colour LCD with the signal-chain view (8 block slots, optional A/B split), UPPER / LOWER push encoders,
// knobs 1-3 under the screen editing the selected block page by page, HOME/VIEW, ACTION, < PAGE, PAGE > buttons,
// 8 capacitive footswitches with LED rings + scribble strips (STOMP / SNAPSHOT / PRESET / LOOPER modes, MODE
// switch, TAP / hold = TUNER), EXP 1 / EXP 2 jacks. Menus: slot → category → model; ACTION menu (move / copy /
// paste / clear / bypass / path); hold HOME = MENU → Global Settings submenu, tempo, tuner.
import { CATS, modelsIn, pText } from './mfx-kit.js';

export function registerVX(tz, kit) {
  const { K, FOOT, SCREEN, def, db } = tz.helpers;
  const { svg, label, formKit, setA, setText } = tz.gfx;
  const ID = 'l6.vxstompxl';
  const N = 8;
  const FONT = "'Barlow Condensed', 'Arial Narrow', 'Helvetica Neue', sans-serif";
  const COL = { dist: '#f2a51c', dyn: '#f5d90a', eq: '#a7afb9', mod: '#2f8cff', dly: '#2fd36a', rev: '#ff7a29', pitch: '#b25cff', filter: '#e45ad6', wah: '#9d4dff', vol: '#30c9c0', amp: '#ff3434', ampo: '#ff5a3d', cab: '#c0303a' };
  const CATLIST = ['dist', 'dyn', 'eq', 'mod', 'dly', 'rev', 'pitch', 'filter', 'wah', 'vol', 'amp', 'ampo', 'cab'];
  const MODES = ['STOMP', 'SNAPSHOT', 'PRESET', 'LOOPER'];
  const FS = [1, 2, 3, 'mode', 4, 5, 6, 'tap'];
  const SNAPCOL = ['#ff3b30', '#2f8cff', '#2fd36a', '#f5d90a'];
  const SNAPS = ['SNAP 1', 'SNAP 2', 'SNAP 3', 'SNAP 4'];
  const shortName = (m) => (m ? m.n.replace(/\s+/g, ' ').slice(0, 9) : '');
  const pName = (k) => `${String(Math.floor(k / 4) + 1).padStart(2, '0')}${'ABCD'[k % 4]}`;

  // ---------------------------------------------------------------- factory presets
  const presets = [
    { name: 'Brit Crunch', slots: { 1: ['gate', { threshold: 0.3 }], 2: ['scream', { gain: 0.3, level: 0.65 }, true], 3: ['redsq', { sustain: 0.35 }], 4: ['ac-plexi', { 'a.gain': 0.55 }], 5: ['plasti', {}, true], 6: ['tape', { mix: 0.22 }], 7: ['plate', { mix: 0.2 }] } },
    { name: 'Glassy Clean', slots: { 1: ['dlxcomp', { sustain: 0.45 }], 2: ['ac-ustwin', {}], 3: ['trinity', { mix: 0.45 }], 4: ['adriatic', { mix: 0.25 }], 5: ['hall', { mix: 0.28 }] } },
    { name: 'Cali Lead', slots: { 1: ['gate', { threshold: 0.4 }], 2: ['scream', { gain: 0.15, level: 0.75 }], 3: ['ac-mk2c', {}], 4: ['simple', { time: 480, mix: 0.25 }], 5: ['room', { mix: 0.18 }] } },
    { name: 'Vibe Trip', slots: { 1: ['fassel', {}, true], 2: ['univibe', {}], 3: ['ac-hiw', { 'a.gain': 0.6 }], 4: ['spring', { mix: 0.3 }] } },
    { name: 'Ambient Swell', slots: { 1: ['volpedal', {}], 2: ['lastudio', {}], 3: ['ac-usdlx', { 'a.gain': 0.35 }], 4: ['dual', { mix: 0.35, feedback: 0.5 }], 5: ['shimmer', { mix: 0.4 }], 6: ['swell', { mix: 0.3 }, true] } },
    { name: 'Metal Rhythm', slots: { 1: ['gate', { threshold: 0.5 }], 2: ['scream', { gain: 0.05, level: 0.8 }], 3: ['ac-5150', {}], 4: ['paraeq', { mid1gain: 2, mid1freq: 700 }], 5: ['room', { mix: 0.12 }] } },
    { name: 'Fuzz Garage', slots: { 1: ['triangle', {}], 2: ['ac-ac30', { 'a.gain': 0.45 }], 3: ['spring', { mix: 0.35 }] } },
    { name: 'Dual Amp A/B', extra: { _split: 1 }, slots: { 1: ['scream', { gain: 0.25 }], 2: ['ac-jcm', {}], 3: ['plasti', {}, true], 5: ['ac-dc30', {}], 6: ['simple', { mix: 0.25 }], 7: ['hall', { mix: 0.25 }] } },
  ];

  // ---------------------------------------------------------------- settings (MENU → Global Settings)
  const SETTINGS = [
    { n: 'Input Gate', p: '_gate', opts: ['Off', 'On'] },
    { n: 'Gate Threshold', p: '_gateT', d: 0.4, min: 0, max: 1, step: 0.05, f: (v) => (v * 10).toFixed(1) },
    { n: 'Signal Path', p: '_split', opts: ['Serial', 'Split A/B'] },
    { n: 'Snapshot Edits', p: '_snapEdit', d: 1, opts: ['Discard', 'Recall'] },
    { n: 'Tap Tempo Delays', p: '_tapSync', d: 1, opts: ['Off', 'On'] },
    { n: 'Tuner Reference', p: '_tref', d: 440, min: 425, max: 455, step: 1, f: (v) => v + ' Hz' },
    { n: 'Tuner Out Mute', p: '_tmute', d: 1, opts: ['Off', 'On'] },
    { n: 'Output Level', p: '_vol', d: 0, min: -30, max: 6, step: 0.5, f: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' },
  ];

  // ---------------------------------------------------------------- navigation
  const layout = (u) => ((u._split ?? 0) > 0.5 ? [{ par: [[1, 2, 3, 4], [5, 6, 7, 8]] }] : [1, 2, 3, 4, 5, 6, 7, 8]);
  const fsSlots = (u) => { const r = []; for (let i = 1; i <= N && r.length < 6; i++) if (kit.slotModel(u, i)) r.push(i); return r; };
  const B = (id) => kit.blk(id);
  const U = (id) => kit.ui(B(id));

  function items(id) {
    const n = kit.nav(id), u = U(id);
    const cur = kit.slotModel(u, n.sel);
    switch (n.view) {
      case 'cats':
        return [{ t: 'None', c: '#555', act: () => { kit.clearSlot(id, n.sel); n.view = 'home'; } }].concat(CATLIST.map((c) => ({
          t: CATS[c].n, c: COL[c], mark: cur && cur.cat === c, r: '▸',
          act: () => { n.cat = c; n.view = 'models'; const l = modelsIn(c); n.cur = Math.max(0, l.findIndex((m) => cur && m.idx === cur.idx)); n.top = 0; },
        })));
      case 'models':
        return modelsIn(n.cat).map((m) => ({ t: m.n, c: COL[m.cat], mark: cur && cur.idx === m.idx, act: () => { kit.setModel(id, n.sel, m.idx); n.view = 'home'; } }));
      case 'action':
        return [
          { t: 'Move Block ◂', act: () => { if (n.sel > 1) { kit.swapSlots(id, n.sel, n.sel - 1); n.sel--; kit.syncKnobs(id); } } },
          { t: 'Move Block ▸', act: () => { if (n.sel < N) { kit.swapSlots(id, n.sel, n.sel + 1); n.sel++; kit.syncKnobs(id); } } },
          { t: 'Copy Block', act: () => kit.copySlot(id, n.sel) },
          { t: 'Paste Block', act: () => kit.pasteSlot(id, n.sel) },
          { t: 'Clear Block', act: () => { kit.clearSlot(id, n.sel); n.view = 'home'; } },
          { t: 'Bypass', r: cur ? (kit.slotOn(u, n.sel) ? 'On' : 'Bypassed') : '-', act: () => kit.toggleSlot(id, n.sel) },
          { t: 'Signal Path', r: (u._split ?? 0) > 0.5 ? 'Split A/B' : 'Serial', act: () => kit.setStep(id, SETTINGS[2], 1) },
          { t: 'Exit', act: () => (n.view = 'home') },
        ];
      case 'menu':
        return [
          { t: 'Global Settings', r: '▸', act: () => { n.view = 'settings'; n.cur = 0; n.top = 0; } },
          { t: 'Tuner', r: '▸', act: () => kit.tuner(id, true) },
          { t: 'Tempo', r: (u._bpm ?? 120).toFixed(1) + ' BPM', tempo: true, act: () => {} },
          { t: 'Reload Preset', r: pName(u._preset | 0), act: () => { kit.loadPreset(id, u._preset | 0, true); n.view = 'home'; } },
          { t: 'Exit', act: () => (n.view = 'home') },
        ];
      case 'settings':
        return SETTINGS.map((row) => ({ t: row.n, r: kit.setText(row, u), row, act: () => kit.setStep(id, row, 1) }));
    }
    return [];
  }
  const TITLES = { cats: 'CHOOSE CATEGORY', models: '', action: 'ACTION', menu: 'MENU', settings: 'GLOBAL SETTINGS' };
  function back(id) {
    const n = kit.nav(id);
    const v = n.view;
    if (v === 'models') { n.view = 'cats'; n.cur = CATLIST.indexOf(n.cat) + 1; n.top = 0; }
    else if (v === 'settings') { n.view = 'menu'; n.cur = 0; n.top = 0; }
    else if (v === 'tuner') kit.tuner(id, false);
    else n.view = 'home';
  }
  function openCats(id) {
    const n = kit.nav(id);
    const m = kit.slotModel(U(id), n.sel);
    n.view = 'cats';
    n.cur = m ? CATLIST.indexOf(m.cat) + 1 : 0;
    n.top = 0;
  }
  const isList = (v) => v in TITLES;
  function move(id, d) {
    const n = kit.nav(id);
    const l = items(id).length;
    n.cur = Math.max(0, Math.min(l - 1, n.cur + d));
  }
  function activate(id) {
    const n = kit.nav(id);
    const it = items(id)[n.cur];
    if (it && it.act) it.act();
  }
  function turn(id, ctl, d) {
    const n = kit.nav(id);
    if (n.view === 'tuner') return;
    if (ctl.enc === 'up') {
      if (n.view === 'home' || n.view === 'play') { kit.selectSlot(id, ((n.sel - 1 + d + N) % N) + 1); n.view = 'home'; }
      else move(id, d);
      return;
    }
    // LOWER knob
    if (n.view === 'home') {
      const u = U(id);
      const m = kit.slotModel(u, n.sel);
      if (!m) return kit.say(id, 'Push UPPER to add a block');
      const l = modelsIn(m.cat);
      const k = (l.findIndex((x) => x.idx === m.idx) + d + l.length) % l.length;
      kit.setModel(id, n.sel, l[k].idx);
    } else if (n.view === 'settings') { const it = items(id)[n.cur]; if (it) kit.setStep(id, it.row, d); }
    else if (n.view === 'menu' && items(id)[n.cur].tempo) kit.setTempo(id, Math.max(30, Math.min(300, (U(id)._bpm ?? 120) + d)));
    else if (isList(n.view)) move(id, d);
  }
  function push(id, ctl) {
    const n = kit.nav(id);
    if (n.view === 'tuner') return kit.tuner(id, false);
    if (n.view === 'home' || n.view === 'play') {
      if (ctl.enc === 'up') openCats(id);
      else kit.toggleSlot(id, n.sel);
      return;
    }
    activate(id);
  }
  function button(id, name, down) {
    const n = kit.nav(id);
    const key = id + '|b' + name;
    if (name === 'home')
      return kit.press(key, down, {
        tap: () => { if (n.view === 'tuner') kit.tuner(id, false); else n.view = n.view === 'home' ? 'play' : 'home'; kit.bump(id); },
        hold: () => { if (n.view === 'tuner') kit.tuner(id, false); n.view = 'menu'; n.cur = 0; n.top = 0; kit.bump(id); }, ms: 750,
      });
    if (!down) return;
    if (name === 'action') { if (n.view === 'home' || n.view === 'play') { n.view = 'action'; n.cur = 0; n.top = 0; } else back(id); }
    else if (name === 'pgl' || name === 'pgr') {
      const d = name === 'pgl' ? -1 : 1;
      if (isList(n.view)) move(id, d * 7);
      else if (n.view !== 'tuner') { n.view = 'home'; kit.page(id, d); }
    }
    // both PAGE buttons together = MENU (like the real unit)
    n.pg = n.pg || {};
    n.pg[name] = performance.now();
    if (n.pg.pgl && n.pg.pgr && Math.abs(n.pg.pgl - n.pg.pgr) < 350) { n.view = 'menu'; n.cur = 0; n.top = 0; n.pg = {}; }
  }
  function footswitch(id, f, down) {
    const n = kit.nav(id);
    n.fsMode = n.fsMode || 0;
    n.bank = n.bank ?? Math.floor((U(id)._preset | 0) / 4);
    const key = id + '|fs' + f;
    if (f === 'tap') return kit.press(key, down, { tap: () => (n.view === 'tuner' ? kit.tuner(id, false) : kit.tap(id)), hold: () => kit.tuner(id), ms: 800 });
    if (f === 'mode') return kit.press(key, down, {
      tap: () => { if (n.view === 'tuner') return kit.tuner(id, false); n.fsMode = n.fsMode >= 2 ? 0 : n.fsMode + 1; kit.say(id, MODES[n.fsMode] + ' MODE'); },
      hold: () => { n.fsMode = 3; kit.say(id, 'LOOPER'); }, ms: 800,
    });
    const u = U(id);
    if (n.view === 'tuner') { if (down) kit.tuner(id, false); return; }
    if (n.fsMode === 3) {
      const ls = kit.loopState(tz.app.state.status.blocks[id]);
      if (f === 3) return kit.press(key, down, { tap: () => kit.looper(id, 'undo'), hold: () => kit.looper(id, 'clear'), ms: 900 });
      if (!down) return;
      if (f === 1) kit.looper(id, 'rec');
      else if (f === 2) kit.looper(id, ls === 1 || ls === 2 || ls === 3 ? 'stop' : 'play');
      else if (f === 4) kit.looper(id, 'clear');
      else if (f === 6) { n.fsMode = 0; kit.say(id, 'STOMP MODE'); }
      return;
    }
    if (!down) return;
    if (n.fsMode === 0) {
      const s = fsSlots(u)[f - 1];
      if (s) { kit.toggleSlot(id, s); n.sel = s; kit.syncKnobs(id); }
    } else if (n.fsMode === 1) {
      if (f <= 4) kit.recallSnap(id, f - 1);
      else kit.loadPreset(id, ((u._preset | 0) + (f === 5 ? 31 : 1)) % 32);
    } else if (n.fsMode === 2) {
      if (f <= 4) kit.loadPreset(id, n.bank * 4 + f - 1);
      else n.bank = (n.bank + (f === 5 ? 7 : 1)) % 8;
    }
  }
  // footswitch label / colour / lit state for the scribble strips and LED rings
  function fsInfo(id, u, n, k, st, now) {
    const f = FS[k];
    const mode = n.fsMode || 0;
    if (f === 'mode') return { t: MODES[mode], c: '#ffffff', lit: true };
    if (f === 'tap') {
      const per = 60000 / (u._bpm || 120);
      return { t: n.view === 'tuner' ? 'TUNER' : `TAP ${Math.round(u._bpm || 120)}`, c: '#ff3b30', lit: now % per < 90 };
    }
    if (mode === 0) {
      const s = fsSlots(u)[f - 1];
      const m = s && kit.slotModel(u, s);
      return m ? { t: m.n.slice(0, 13), c: COL[m.cat], lit: kit.slotOn(u, s) } : { t: '', c: '#333', lit: false };
    }
    if (mode === 1) {
      if (f <= 4) return { t: SNAPS[f - 1], c: SNAPCOL[f - 1], lit: (u._snap | 0) === f - 1 };
      return { t: f === 5 ? 'PRESET ▼' : 'PRESET ▲', c: '#c8cdd6', lit: false };
    }
    if (mode === 2) {
      const bank = n.bank ?? Math.floor((u._preset | 0) / 4);
      if (f <= 4) { const k2 = bank * 4 + f - 1; return { t: pName(k2) + ' ' + kit.presetName(B(id), k2).slice(0, 8), c: '#2f8cff', lit: (u._preset | 0) === k2 }; }
      return { t: f === 5 ? 'BANK ▼' : 'BANK ▲', c: '#c8cdd6', lit: false };
    }
    const ls = kit.loopState(st);
    return [
      { t: ls === 3 ? 'OVERDUB' : 'REC/DUB', c: '#ff3b30', lit: ls === 1 || ls === 3 },
      { t: ls === 2 || ls === 3 ? 'STOP' : 'PLAY', c: '#2fd36a', lit: ls === 2 },
      { t: 'UNDO', c: '#f5d90a', lit: false },
      { t: 'CLEAR', c: '#ff7a29', lit: false },
      { t: '', c: '#333', lit: false },
      { t: 'EXIT', c: '#ffffff', lit: false },
    ][f - 1];
  }

  // ---------------------------------------------------------------- screens
  const T = (g, x, y, s, o = {}) => kit.svgT(g, x, y, s, Object.assign({ font: FONT, weight: 600 }, o));
  const show = (el, on) => setA(el, 'display', on ? 'inline' : 'none');
  function slotXY(i, split) {
    if (!split) return [16 + (i - 1) * 24, 30];
    return [32 + ((i - 1) % 4) * 40, i <= 4 ? 21 : 42];
  }
  tz.addScreen('vx-main', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      svg('rect', { width: w, height: h, fill: '#000' }, g);
      // ---- home
      const H = (s.home = svg('g', {}, g));
      svg('rect', { width: w, height: 11, fill: '#15171c' }, H);
      s.hdrL = T(H, 4, 5.8, '', { size: 6.6, weight: 700 });
      s.chip = svg('rect', { x: w - 66, y: 1.8, width: 30, height: 7.6, rx: 1.6, fill: '#2f8cff' }, H);
      s.chipT = T(H, w - 51, 5.8, '', { size: 5, weight: 700, anchor: 'middle', fill: '#000' });
      s.bpm = T(H, w - 4, 5.8, '', { size: 5.4, anchor: 'end', fill: '#8a93a3' });
      s.line = svg('path', { d: '', stroke: '#5c6270', 'stroke-width': 0.8, fill: 'none' }, H);
      s.inT = T(H, 2, 30, 'IN', { size: 3.8, fill: '#7d8597' });
      s.outT = T(H, w - 2, 30, 'OUT', { size: 3.8, fill: '#7d8597', anchor: 'end' });
      s.slots = [];
      for (let i = 1; i <= N; i++) {
        const sg = svg('g', {}, H);
        const ring = svg('rect', { x: -10.5, y: -9.5, width: 21, height: 19, rx: 3.5, fill: 'none', stroke: '#fff', 'stroke-width': 1, 'stroke-opacity': 0 }, sg);
        const box = svg('rect', { x: -8.5, y: -7.5, width: 17, height: 15, rx: 2.4, fill: '#000', stroke: '#444', 'stroke-width': 0.8 }, sg);
        const dot = svg('circle', { r: 1.6, fill: '#000', stroke: '#5c6270', 'stroke-width': 0.6 }, sg);
        const ic = T(sg, 0, 0.3, '', { size: 4.1, weight: 800, anchor: 'middle', fill: '#000' });
        const lab = T(sg, 0, 12, '', { size: 3.9, anchor: 'middle', fill: '#c8cdd6' });
        s.slots.push({ sg, ring, box, dot, ic, lab });
      }
      svg('rect', { x: 0, y: 58, width: w, height: 0.6, fill: '#2a2e36' }, H);
      s.mName = T(H, 4, 64.5, '', { size: 7.4, weight: 700 });
      s.mCat = T(H, w - 4, 64.5, '', { size: 5.2, anchor: 'end', weight: 700 });
      s.prm = [0, 1, 2].map((k) => {
        const x = 2 + k * ((w - 4) / 3), bw = (w - 4) / 3 - 3;
        const bg = svg('rect', { x, y: 70, width: bw, height: 27, rx: 2, fill: '#101318', stroke: '#252a33', 'stroke-width': 0.5 }, H);
        const nm = T(H, x + bw / 2, 75.5, '', { size: 5, anchor: 'middle', fill: '#9aa3b5' });
        const vl = T(H, x + bw / 2, 84.5, '', { size: 8, anchor: 'middle', weight: 700 });
        svg('rect', { x: x + 3, y: 92, width: bw - 6, height: 2, rx: 1, fill: '#252a33' }, H);
        const bar = svg('rect', { x: x + 3, y: 92, width: 0, height: 2, rx: 1, fill: '#2f8cff' }, H);
        return { bg, nm, vl, bar, bw: bw - 6 };
      });
      // ---- lists
      const L = (s.list = svg('g', {}, g));
      svg('rect', { width: w, height: 11, fill: '#15171c' }, L);
      s.lTitle = T(L, 4, 5.8, '', { size: 6.4, weight: 700 });
      s.lSub = T(L, w - 4, 5.8, '', { size: 5.2, anchor: 'end', fill: '#8a93a3' });
      s.rows = [];
      for (let r = 0; r < 8; r++) {
        const y = 13 + r * 10.8;
        const hl = svg('rect', { x: 2, y, width: w - 9, height: 10, rx: 1.5, fill: '#2f8cff', 'fill-opacity': 0 }, L);
        const sw = svg('rect', { x: 5, y: y + 2.5, width: 5, height: 5, rx: 1, fill: '#555' }, L);
        const t = T(L, 14, y + 5.2, '', { size: 6.2 });
        const rr = T(L, w - 10, y + 5.2, '', { size: 5.6, anchor: 'end', fill: '#9aa3b5' });
        s.rows.push({ hl, sw, t, rr, y });
      }
      svg('rect', { x: w - 5, y: 13, width: 2, height: 86, rx: 1, fill: '#1c2028' }, L);
      s.thumb = svg('rect', { x: w - 5, y: 13, width: 2, height: 20, rx: 1, fill: '#6b7385' }, L);
      // ---- tuner
      const TU = (s.tun = svg('g', {}, g));
      T(TU, w / 2, 8, 'TUNER', { size: 6, anchor: 'middle', fill: '#8a93a3', weight: 700, ls: 1.5 });
      s.tNote = T(TU, w / 2, 42, '', { size: 30, anchor: 'middle', weight: 700 });
      for (let k = -10; k <= 10; k++) svg('rect', { x: w / 2 + k * 8 - 0.4, y: k % 5 ? 70 : 67, width: 0.8, height: k % 5 ? 5 : 8, fill: k ? '#4b5261' : '#2fd36a' }, TU);
      s.tNeedle = svg('rect', { x: w / 2 - 1.5, y: 64, width: 3, height: 14, rx: 1, fill: '#ff3b30' }, TU);
      s.tC = T(TU, w / 2, 86, '', { size: 6, anchor: 'middle', fill: '#9aa3b5' });
      s.tHint = T(TU, w / 2, 96, 'press any switch to exit', { size: 4.6, anchor: 'middle', fill: '#5d6575' });
      // ---- play view
      const PV = (s.play = svg('g', {}, g));
      s.pvName = T(PV, w / 2, 16, '', { size: 13, anchor: 'middle', weight: 700 });
      s.pvSub = T(PV, w / 2, 29, '', { size: 6, anchor: 'middle', fill: '#9aa3b5' });
      s.cells = [];
      for (let k = 0; k < 8; k++) {
        const x = 4 + (k % 4) * ((w - 8) / 4), y = k < 4 ? 38 : 69, cw = (w - 8) / 4 - 3;
        const r = svg('rect', { x, y, width: cw, height: 27, rx: 2.5, fill: '#101318', stroke: '#333', 'stroke-width': 0.8 }, PV);
        const t = T(PV, x + cw / 2, y + 13.5, '', { size: 5.8, anchor: 'middle', weight: 700 });
        s.cells.push({ r, t });
      }
      // ---- toast
      s.toast = svg('g', { display: 'none' }, g);
      svg('rect', { x: w / 2 - 55, y: h / 2 - 9, width: 110, height: 18, rx: 3, fill: '#20242c', stroke: '#2f8cff', 'stroke-width': 0.8 }, s.toast);
      s.toastT = T(s.toast, w / 2, h / 2, '', { size: 7, anchor: 'middle', weight: 700 });
      s.sig = '';
    },
    update(s, st, nv, now) {
      const b = nv.block, id = b.id, u = s.ui, n = kit.nav(id);
      const w = s.w, h = s.h;
      const lv = kit.live.get(id);
      // footswitch rings / scribble strips (cheap: setA / setText only touch the DOM on change)
      if (lv) FS.forEach((_, k) => {
        const fi = fsInfo(id, u, n, k, st, now);
        setA(lv.rings[k], 'stroke', fi.c);
        setA(lv.rings[k], 'stroke-opacity', fi.lit ? 1 : 0.22);
        setText(lv.strips[k], fi.t);
        setA(lv.strips[k], 'fill', fi.lit ? fi.c : '#8d939e');
      });
      const toastOn = n.msg && now - n.msgT < 1300;
      show(s.toast, toastOn);
      if (toastOn) setText(s.toastT, n.msg);
      const v = n.view;
      show(s.home, v === 'home');
      show(s.list, isList(v));
      show(s.tun, v === 'tuner');
      show(s.play, v === 'play');
      if (v === 'tuner') {
        const t = st && st.tu && st.tu.tuner;
        if (t && t.note) {
          const ok = Math.abs(t.cents) < 2;
          setText(s.tNote, t.note);
          setA(s.tNote, 'fill', ok ? '#2fd36a' : '#ffffff');
          setA(s.tNeedle, 'x', (w / 2 - 1.5 + Math.max(-1, Math.min(1, t.cents / 50)) * 80).toFixed(1));
          setA(s.tNeedle, 'fill', ok ? '#2fd36a' : '#ff3b30');
          setText(s.tC, `${t.cents >= 0 ? '+' : ''}${t.cents.toFixed(1)} ¢   ${t.freq ? t.freq.toFixed(1) + ' Hz' : ''}`);
        } else { setText(s.tNote, '-'); setA(s.tNote, 'fill', '#5d6575'); setText(s.tC, `${u._tref ?? 440} Hz`); }
        return;
      }
      const sig = n.rev + '|' + v + '|' + n.sel + '|' + n.page + '|' + n.cur + '|' + (n.fsMode || 0) + '|' + JSON.stringify(b.params) + '|' + (b.mfx ? b.mfx.preset + b.mfx.name : '');
      if (sig === s.sig) return;
      s.sig = sig;
      if (v === 'home') {
        const split = (u._split ?? 0) > 0.5;
        setText(s.hdrL, `${pName(u._preset | 0)}  ${kit.presetName(b)}`);
        setText(s.chipT, n.fsMode === 3 ? 'LOOPER' : n.fsMode === 2 ? 'PRESET' : n.fsMode === 1 ? 'SNAP ' + ((u._snap | 0) + 1) : 'STOMP');
        setA(s.chip, 'fill', n.fsMode === 1 ? SNAPCOL[u._snap | 0] : n.fsMode === 3 ? '#ff3b30' : '#c8cdd6');
        setText(s.bpm, `♩${Math.round(u._bpm ?? 120)}`);
        setA(s.line, 'd', split ? `M7 31.5 H14 M14 21 V42 M14 21 H${w - 14} M14 42 H${w - 14} M${w - 14} 21 V42 M${w - 14} 31.5 H${w - 9}` : `M7 30 H${w - 9}`);
        setA(s.inT, 'y', split ? 31.5 : 30);
        setA(s.outT, 'y', split ? 31.5 : 30);
        for (let i = 1; i <= N; i++) {
          const e = s.slots[i - 1];
          const m = kit.slotModel(u, i), on = kit.slotOn(u, i);
          const [x, y] = slotXY(i, split);
          setA(e.sg, 'transform', `translate(${x},${y})`);
          show(e.box, !!m); show(e.ic, !!m); show(e.dot, !m);
          if (m) {
            const c = COL[m.cat];
            setA(e.box, 'fill', on ? c : '#000');
            setA(e.box, 'stroke', c);
            setText(e.ic, CATS[m.cat].s);
            setA(e.ic, 'fill', on ? '#000' : c);
          }
          setText(e.lab, m ? shortName(m).slice(0, 8) : '');
          setA(e.lab, 'fill', m && !on ? '#666c78' : '#c8cdd6');
          setA(e.ring, 'stroke-opacity', i === n.sel ? 1 : 0);
        }
        const m = kit.slotModel(u, n.sel);
        setText(s.mName, m ? m.n : `Slot ${n.sel}: empty`);
        const np = kit.pages(u, n.sel, 3);
        setText(s.mCat, m ? CATS[m.cat].n.toUpperCase() + (kit.slotOn(u, n.sel) ? '' : ' · OFF') + `   ${n.page + 1}/${np}` : 'PUSH UPPER TO ADD');
        setA(s.mCat, 'fill', m ? COL[m.cat] : '#6b7385');
        const per = 3;
        s.prm.forEach((e, k) => {
          const j = n.page * per + k;
          const p = m && m.P[j];
          show(e.bg, true);
          setText(e.nm, p ? p.n : '');
          const pos = p ? kit.slotPos(u, n.sel, j, m) : 0;
          setText(e.vl, p ? pText(p, pos) : '');
          setA(e.bar, 'width', p ? (pos * e.bw).toFixed(1) : 0);
          setA(e.bar, 'fill', m ? COL[m.cat] : '#2f8cff');
        });
      } else if (isList(v)) {
        const it = items(id);
        n.cur = Math.min(n.cur, it.length - 1);
        n.top = kit.windowTop(it.length, n.cur, n.top || 0, 8);
        const m = kit.slotModel(u, n.sel);
        setText(s.lTitle, v === 'models' ? CATS[n.cat].n.toUpperCase() : TITLES[v]);
        setText(s.lSub, v === 'cats' || v === 'models' || v === 'action' ? `SLOT ${n.sel}${m ? ' · ' + m.n : ''}` : `${pName(u._preset | 0)}`);
        s.rows.forEach((r, k) => {
          const e = it[n.top + k];
          show(r.t, !!e); show(r.rr, !!e);
          show(r.sw, !!(e && e.c));
          if (!e) { setA(r.hl, 'fill-opacity', 0); return; }
          const sel = n.top + k === n.cur;
          setText(r.t, (e.mark ? '• ' : '') + e.t);
          setText(r.rr, e.r || '');
          if (e.c) setA(r.sw, 'fill', e.c);
          setA(r.hl, 'fill', e.c && (v === 'cats' || v === 'models') ? e.c : '#2f8cff');
          setA(r.hl, 'fill-opacity', sel ? 0.9 : 0);
          setA(r.t, 'fill', sel ? '#000' : '#e9ecf3');
          setA(r.rr, 'fill', sel ? '#000' : '#9aa3b5');
          setA(r.t, 'x', e.c ? 14 : 6);
        });
        const th = Math.max(8, (86 * 8) / Math.max(8, it.length));
        setA(s.thumb, 'height', th.toFixed(1));
        setA(s.thumb, 'y', (13 + (86 - th) * (it.length > 8 ? n.top / (it.length - 8) : 0)).toFixed(1));
      } else if (v === 'play') {
        setText(s.pvName, kit.presetName(b));
        setText(s.pvSub, `${pName(u._preset | 0)}  ·  ${MODES[n.fsMode || 0]}  ·  SNAP ${(u._snap | 0) + 1}  ·  ♩${Math.round(u._bpm ?? 120)}`);
        s.cells.forEach((c, k) => {
          const fi = fsInfo(id, u, n, k, st, now);
          setText(c.t, fi.t);
          setA(c.r, 'stroke', fi.c);
          setA(c.r, 'fill', fi.lit ? fi.c : '#101318');
          setA(c.t, 'fill', fi.lit ? '#000' : fi.c);
        });
      }
      void h;
    },
    pointer(s, nv, type, pt) {
      // touch-style shortcuts: tap a block to select it, tap again to choose its model; tap list rows
      if (type !== 'down' && type !== 'dbl') return;
      const id = nv.block.id, n = kit.nav(id), u = s.ui;
      if (n.view === 'home') {
        const split = (u._split ?? 0) > 0.5;
        for (let i = 1; i <= N; i++) {
          const [x, y] = slotXY(i, split);
          if (Math.abs(pt.x - x) < 11 && Math.abs(pt.y - y) < 11) {
            if (n.sel === i && type === 'down') openCats(id);
            else kit.selectSlot(id, i);
            kit.bump(id);
            return;
          }
        }
        if (pt.y > 68) { n.view = 'home'; kit.page(id, pt.x > s.w / 2 ? 1 : -1); }
      } else if (isList(n.view)) {
        if (pt.y < 12) { back(id); kit.bump(id); return; }
        const r = Math.floor((pt.y - 13) / 10.8);
        if (r >= 0 && r < 8 && n.top + r < items(id).length) {
          if (n.cur === n.top + r) activate(id);
          else n.cur = n.top + r;
          kit.bump(id);
        }
      } else if (n.view === 'tuner') kit.tuner(id, false);
      else if (n.view === 'play') { n.view = 'home'; kit.bump(id); }
    },
  });
  // UPPER / LOWER push encoders
  kit.addEncoder('vx-enc', (s, g, w, h) => {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 2;
    svg('circle', { cx, cy: cy + 1.5, r: r + 1.2, fill: '#000', 'fill-opacity': 0.55 }, g);
    svg('circle', { cx, cy, r, fill: 'url(#g-knobBlack)', stroke: '#2b2d33', 'stroke-width': 0.8 }, g);
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      svg('line', { x1: cx + Math.cos(a) * (r - 0.6), y1: cy + Math.sin(a) * (r - 0.6), x2: cx + Math.cos(a) * (r - 2.6), y2: cy + Math.sin(a) * (r - 2.6), stroke: '#000', 'stroke-width': 1, 'stroke-opacity': 0.6 }, g);
    }
    svg('circle', { cx, cy, r: r * 0.62, fill: '#17181c', stroke: '#33363d', 'stroke-width': 0.6 }, g);
    const rot = svg('g', { transform: 'rotate(0)' }, svg('g', { transform: `translate(${cx},${cy})` }, g));
    svg('line', { x1: 0, y1: -r * 0.55, x2: 0, y2: -r * 0.2, stroke: '#e8e8e8', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, rot);
    svg('rect', { width: w, height: h, fill: 'transparent' }, g);
    return rot;
  }, turn, push);

  // ---------------------------------------------------------------- enclosure
  const W = 500, H = 312;
  const BTNS = [['home', 'HOME', 'VIEW', 362, 42], ['action', 'ACTION', '', 412, 42], ['pgl', '◂ PAGE', '', 362, 92], ['pgr', 'PAGE ▸', '', 412, 92]];
  const FSX = (k) => 70 + (k % 4) * 120, FSY = (k) => (k < 4 ? 204 : 280);
  tz.addForm('vx-stompxl', (ctx, d) => {
    const g = ctx.g;
    formKit.body(g, W, H, '#141518', { rx: 11 });
    svg('rect', { x: 6, y: 6, width: W - 12, height: 150, rx: 8, fill: '#0b0c0e', 'fill-opacity': 0.55 }, g);
    svg('rect', { x: 6, y: 156, width: W - 12, height: 0.8, fill: '#fff', 'fill-opacity': 0.06 }, g);
    const theme = { text: '#c8ccd4', knob: 'strymon', labelSize: 5.6, labelFont: FONT };
    label(g, 456, 128, 'VX STOMP XL', { size: 10, fill: '#e6e8ec', weight: 800, ls: 1.6, font: FONT });
    formKit.tzBadge(g, 456, 140, '#7b808a', 4.2);
    label(g, 310, 23, 'UPPER', { size: 5, fill: '#8a8f99', weight: 700, font: FONT });
    label(g, 310, 72, 'LOWER', { size: 5, fill: '#8a8f99', weight: 700, font: FONT });
    for (const [, t1, t2, x, y] of BTNS) {
      svg('rect', { x: x - 16, y: y - 7, width: 32, height: 14, rx: 3, fill: '#000', 'fill-opacity': 0.6 }, g);
      svg('rect', { x: x - 15, y: y - 6.5, width: 30, height: 12, rx: 2.5, fill: '#24262b', stroke: '#3a3d44', 'stroke-width': 0.6 }, g);
      label(g, x, y - 13, t1, { size: 5.2, fill: '#c8ccd4', weight: 700, font: FONT });
      if (t2) label(g, x, y + 13, t2, { size: 4.6, fill: '#7d828c', weight: 700, font: FONT });
    }
    // capacitive footswitch rings + scribble strips (colours / text driven by the main screen's update)
    const rings = [], strips = [];
    FS.forEach((f, k) => {
      const x = FSX(k), y = FSY(k);
      svg('rect', { x: x - 38, y: y - 40, width: 76, height: 14, rx: 2, fill: '#020203', stroke: '#2a2c31', 'stroke-width': 0.8 }, g);
      strips.push(svg('text', { x, y: y - 32.6, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT, 'font-weight': 700, 'font-size': 6.6, fill: '#8d939e', 'pointer-events': 'none' }, g, ''));
      svg('circle', { cx: x, cy: y, r: 18.5, fill: '#08090a', stroke: '#2b2d33', 'stroke-width': 0.8 }, g);
      rings.push(svg('circle', { cx: x, cy: y, r: 16, fill: 'none', stroke: '#444', 'stroke-width': 2.2, 'stroke-opacity': 0.25 }, g));
      label(g, x + 30, y + 14, typeof f === 'number' ? `FS${f}` : f.toUpperCase(), { size: 4.4, fill: '#5d626c', weight: 700, font: FONT });
    });
    if (ctx.block) kit.live.set(ctx.block.id, { rings, strips });
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: kit.topJacks(d, W, ctx.flip, 30, W - 30) };
  });

  const controls = [
    SCREEN('vx-main', { x: 170, y: 66, w: 200, h: 100, interactive: true, bg: '#000', bezel: '#050506' }),
    K('_vol', 'VOLUME', { x: 34, y: 46, r: 10, min: -30, max: 6, def: 0, virtual: true, display: db, labelPos: 'below' }),
    K('k1', '1', { x: 103, y: 138, r: 10, def: 0.5, virtual: true, labelPos: 'none' }),
    K('k2', '2', { x: 170, y: 138, r: 10, def: 0.5, virtual: true, labelPos: 'none' }),
    K('k3', '3', { x: 237, y: 138, r: 10, def: 0.5, virtual: true, labelPos: 'none' }),
    SCREEN('vx-enc', { enc: 'up', x: 310, y: 44, w: 30, h: 30, interactive: true, bg: 'transparent', bezel: 'transparent' }),
    SCREEN('vx-enc', { enc: 'lo', x: 310, y: 97, w: 30, h: 30, interactive: true, bg: 'transparent', bezel: 'transparent' }),
    ...BTNS.map(([btn, , , x, y]) => FOOT({ action: 'mfx', mfx: 'btn', btn, style: 'plate', w: 32, h: 14, x, y })),
    ...FS.map((fs, k) => FOOT({ action: 'mfx', mfx: 'fs', fs, style: 'soft', r: 12, x: FSX(k), y: FSY(k) })),
  ];
  const d = def({
    id: ID, name: 'VX Stomp XL', ref: 'Line 6 HX Stomp XL', brand: 'Line 6', code: 'VX STOMP XL', typeName: 'Amp & effects modeler', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'vx-stompxl', color: '#141518', cost: 7, alwaysOn: true,
    ports: { ins: ['IN L/MONO', 'IN R', 'RETURN L', 'RETURN R'], outs: ['OUT L/MONO', 'OUT R', 'SEND L', 'SEND R', 'PHONES'] }, jackKinds: { o4: 'phones' },
    ctrl: { ins: [{ label: 'EXP 1', hook: true, exp: 1 }, { label: 'EXP 2', hook: true, exp: 2 }] },
    controls,
    tags: ['helix', 'modeler', 'snapshot', 'looper', 'amp modeler'],
    desc: 'Eight block slots for amps, cabs and effects, in series or split A/B. Turn UPPER to pick a block (push to choose its model), knobs 1-3 edit it, hold HOME for the menu, MODE switches footswitch modes and hold TAP for the tuner.',
  });
  kit.register(d, {
    n: N, knobs: 3, layout, inputGate: true, looper: true, presets, snapWord: 'Snapshot',
    foot(id, ctl, down) {
      if (ctl.mfx === 'btn') button(id, ctl.btn, down);
      else footswitch(id, ctl.fs, down);
    },
  });
  tz.addDefs([d]);
}
