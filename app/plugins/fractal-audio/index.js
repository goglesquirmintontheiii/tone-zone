// Built-in Tone Zone plugin: Fractal Audio.
// "Axis M3" – inspired by the Fractal Audio FM3: blue-and-black display with the 4 × 6 routing grid (blocks in
// the same columns on different rows run as parallel rows), A–E knobs, VALUE wheel, nav pad + ENTER, HOME /
// LAYOUT / EDIT / EXIT / TEMPO / STORE / PAGE buttons, three footswitches with mini displays + LED rings and
// footswitch layouts (SCENES / EFFECTS / PRESETS / LOOPER). Names and artwork are Tone Zone originals.
import { createKit, CATS, modelsIn, pText } from './mfx-kit.js';

export default function register(tz) {
  const kit = createKit(tz);
  const { K, FOOT, SCREEN, def, db } = tz.helpers;
  const { svg, label, formKit, setA, setText } = tz.gfx;
  const ID = 'fas.axism3';
  const ROWS = 4, COLS = 6, N = ROWS * COLS;
  const FONT = "'Rajdhani', 'DejaVu Sans Condensed', 'Arial Narrow', sans-serif";
  const CY = '#39c6ff', TXT = '#dfe9f7', DIM = '#7f95b5';
  const COL = { dist: '#ff9b3d', dyn: '#e6d84a', eq: '#a9b8cc', mod: '#5aa9ff', dly: '#46d6a0', rev: '#b48cff', pitch: '#ff7ab8', filter: '#e08cff', wah: '#ffb35c', vol: '#7fe0e0', amp: '#ff5a5a', ampo: '#ff5a5a', cab: '#ff8a7a' };
  const ALL = ['amp', 'ampo', 'cab', 'dist', 'dyn', 'eq', 'mod', 'dly', 'rev', 'pitch', 'filter', 'wah', 'vol'];
  const LAYOUTS = ['SCENES', 'EFFECTS', 'PRESETS', 'LOOPER'];
  const SCENECOL = ['#39c6ff', '#46d6a0', '#ffd23a', '#ff7ab8', '#ff9b3d', '#b48cff', '#7fe0e0', '#ff5a5a'];
  const rc = (i) => [Math.floor((i - 1) / COLS), (i - 1) % COLS];
  const idx = (r, c) => r * COLS + c + 1;
  const pNum = (k) => String(k).padStart(3, '0');
  const ABBR = { drive: 'DRV', boost: 'BST', comp: 'CMP', gate: 'GTE', peq: 'PEQ', geq: 'GEQ', chorus: 'CHO', flanger: 'FLG', phaser: 'PHA', tremolo: 'TRM', vibe: 'VIB', rotary: 'ROT', ringmod: 'RNG', delay: 'DLY', reverb: 'REV', pitch: 'PIT', synth: 'SYN', crusher: 'FLT', lofi: 'FLT', volume: 'VOL', utility: 'VOL', stereo: 'ENH' };
  const abbr = (m) => (!m ? '' : m.cat === 'amp' || m.cat === 'ampo' ? 'AMP' : m.cat === 'cab' ? 'CAB' : m.algo === 'wah' ? (m.cat === 'wah' ? 'WAH' : 'FLT') : ABBR[m.algo] || 'FX');

  // ---------------------------------------------------------------- routing: columns, parallel rows
  function layout(u) {
    const occ = (r, c) => !!kit.slotModel(u, idx(r, c));
    const rowsIn = (c) => [0, 1, 2, 3].filter((r) => occ(r, c));
    const steps = [];
    let c = 0;
    while (c < COLS) {
      const rs = rowsIn(c);
      if (rs.length < 2) { rs.forEach((r) => steps.push(idx(r, c))); c++; continue; }
      let e = c;
      while (e + 1 < COLS && rowsIn(e + 1).length >= 2) e++;
      const rows = [0, 1, 2, 3].filter((r) => { for (let x = c; x <= e; x++) if (occ(r, x)) return true; return false; });
      steps.push({ par: rows.map((r) => { const p = []; for (let x = c; x <= e; x++) if (occ(r, x)) p.push(idx(r, x)); return p; }) });
      c = e + 1;
    }
    return steps;
  }
  const S = (r, c) => idx(r, c);
  const presets = [
    { name: 'Plexi Rhythm', slots: { [S(1, 0)]: ['scream', { gain: 0.25, level: 0.65 }, true], [S(1, 1)]: ['a-plexi'], [S(1, 2)]: ['c-4x12gb'], [S(1, 3)]: ['tape', { mix: 0.2 }], [S(1, 4)]: ['plate', { mix: 0.2 }] } },
    { name: 'Clean Spread', slots: { [S(1, 0)]: ['dlxcomp'], [S(1, 1)]: ['a-usdlx'], [S(1, 2)]: ['c-1x12us'], [S(1, 3)]: ['trinity', { mix: 0.45 }], [S(1, 4)]: ['adriatic', { mix: 0.4 }], [S(0, 4)]: ['hall', { mix: 0.5 }] } },
    { name: 'USA Lead', slots: { [S(1, 0)]: ['scream', { gain: 0.15, level: 0.75 }], [S(1, 1)]: ['a-mk2c'], [S(1, 2)]: ['c-4x12v30'], [S(1, 3)]: ['simple', { time: 460, mix: 0.25 }], [S(1, 4)]: ['room', { mix: 0.18 }] } },
    { name: 'Hi Gain Chug', slots: { [S(1, 0)]: ['gate', { threshold: 0.45 }], [S(1, 1)]: ['a-5150'], [S(1, 2)]: ['c-4x12v30'], [S(1, 3)]: ['paraeq', { mid1gain: 2 }], [S(1, 4)]: ['room', { mix: 0.12 }] } },
    { name: 'Dual Amp Rows', slots: { [S(0, 1)]: ['a-plexi'], [S(0, 2)]: ['c-4x12gb'], [S(1, 1)]: ['a-recto', { 'a.gain': 0.4 }], [S(1, 2)]: ['c-4x12v30'], [S(1, 3)]: ['simple', { mix: 0.2 }], [S(1, 4)]: ['hall', { mix: 0.2 }] } },
    { name: 'Ambient Wash', slots: { [S(1, 0)]: ['a-usdlx', { 'a.gain': 0.35 }], [S(1, 1)]: ['c-1x12us'], [S(1, 2)]: ['dual', { mix: 0.5 }], [S(0, 2)]: ['shimdly', { mix: 0.5 }], [S(1, 3)]: ['shimmer', { mix: 0.4 }] } },
    { name: 'Fuzz & Vibe', slots: { [S(1, 0)]: ['triangle'], [S(1, 1)]: ['univibe'], [S(1, 2)]: ['a-hiw'], [S(1, 3)]: ['c-4x12gb'], [S(1, 4)]: ['spring', { mix: 0.3 }] } },
  ];
  const SETTINGS = [
    { n: 'Input Gate', p: '_gate', opts: ['Off', 'On'] },
    { n: 'Gate Threshold', p: '_gateT', d: 0.4, min: 0, max: 1, step: 0.05, f: (v) => (v * 10).toFixed(1) },
    { n: 'Scene Revert', p: '_snapEdit', d: 1, opts: ['On', 'Off'] },
    { n: 'Tempo To Delays', p: '_tapSync', d: 1, opts: ['None', 'Auto'] },
    { n: 'Tuner Reference', p: '_tref', d: 440, min: 425, max: 455, step: 1, f: (v) => v + ' Hz' },
    { n: 'Tuner Mute', p: '_tmute', d: 1, opts: ['Off', 'On'] },
    { n: 'Output 1 Level', p: '_vol', d: 0, min: -30, max: 6, step: 0.5, f: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' },
  ];
  const B = (id) => kit.blk(id);
  const U = (id) => kit.ui(B(id));
  const M = kit.menus({
    n: N, col: COL, settings: SETTINGS, cats: () => ALL,
    menu: (id) => {
      const n = kit.nav(id), u = U(id);
      return [
        { t: 'Setup: Global Config', r: '▸', act: () => M.open(id, 'settings') },
        { t: 'Tuner', r: '▸', act: () => kit.tuner(id, true) },
        { t: 'Tempo', r: (u._bpm ?? 120).toFixed(0) + ' BPM', turn: (d) => kit.setTempo(id, Math.max(30, Math.min(300, (u._bpm ?? 120) + d))), act: () => {} },
        { t: 'Footswitch Layout', r: LAYOUTS[n.fsMode || 0], turn: (d) => { n.fsMode = ((n.fsMode || 0) + d + 4) % 4; }, act: () => { n.fsMode = ((n.fsMode || 0) + 1) % 4; } },
        { t: 'Recall Factory Preset', r: pNum(u._preset | 0), act: () => { kit.loadPreset(id, u._preset | 0, true); n.view = 'home'; } },
        { t: 'Exit', act: () => (n.view = 'home') },
      ];
    },
  });
  const TITLES = { cats: 'ADD BLOCK', models: '', action: 'ACTION', menu: 'SETUP', settings: 'GLOBAL CONFIG' };
  const effects = (u) => { const r = []; for (let c = 0; c < COLS; c++) for (let rr = 0; rr < ROWS; rr++) { const i = idx(rr, c); const m = kit.slotModel(u, i); if (m && m.cat !== 'amp' && m.cat !== 'ampo' && m.cat !== 'cab') r.push(i); } return r.slice(0, 3); };

  // ---------------------------------------------------------------- behaviour
  function openEdit(id) {
    const n = kit.nav(id);
    if (!kit.slotModel(U(id), n.sel)) return M.openSlot(id);
    n.view = 'edit'; n.row = n.row || 1; kit.syncKnobs(id);
  }
  function arrow(id, dir) {
    const n = kit.nav(id);
    const v = n.view;
    const [r, c] = rc(n.sel);
    if (v === 'grid' || v === 'home') {
      n.view = 'grid';
      const nr = Math.max(0, Math.min(ROWS - 1, r + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0)));
      const nc = Math.max(0, Math.min(COLS - 1, c + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0)));
      kit.selectSlot(id, idx(nr, nc));
    } else if (v === 'edit') {
      const m = kit.slotModel(U(id), n.sel);
      const np = kit.pages(U(id), n.sel, 5);
      if (dir === 'up') n.row = Math.max(0, (n.row ?? 1) - 1);
      else if (dir === 'down') n.row = Math.min(Math.min(5, m ? m.P.length - n.page * 5 : 0), (n.row ?? 1) + 1);
      else kit.page(id, dir === 'left' ? -1 : 1);
      void np;
    } else if (M.isList(v)) {
      if (dir === 'up' || dir === 'down') M.move(id, dir === 'up' ? -1 : 1);
      else if (dir === 'left') M.back(id);
      else enter(id);
    }
  }
  function enter(id) {
    const n = kit.nav(id);
    const v = n.view;
    if (v === 'tuner') return kit.tuner(id, false);
    if (v === 'home') { n.view = 'grid'; return; }
    if (v === 'grid') { n.fromEdit = false; return kit.slotModel(U(id), n.sel) ? openEdit(id) : M.openSlot(id); }
    if (v === 'edit') { if ((n.row ?? 1) === 0) { const m = kit.slotModel(U(id), n.sel); M.openModels(id, m.cat); n.fromEdit = true; } return; }
    if (v === 'settings' || v === 'menu') { const it = M.items(id)[n.cur]; if (it && it.row) return kit.setStep(id, it.row, 1); }
    const was = v;
    M.activate(id);
    if (was === 'models' && n.view === 'home') { n.view = 'edit'; n.row = 1; }
  }
  function exit(id) {
    const n = kit.nav(id);
    const v = n.view;
    if (v === 'edit') n.view = 'grid';
    else if (v === 'grid') n.view = 'home';
    else if (v === 'cats') n.view = 'grid';
    else if (v === 'models') { if (n.fromEdit) { n.view = 'edit'; } else M.back(id); }
    else M.back(id);
  }
  function wheel(id, ctl, d) {
    const n = kit.nav(id);
    const v = n.view;
    if (v === 'tuner') return;
    if (v === 'home') { const u = U(id); return kit.recallSnap(id, ((u._snap | 0) + d + 8) % 8); }
    if (v === 'grid') return kit.selectSlot(id, ((n.sel - 1 + d + N) % N) + 1);
    if (v === 'edit') {
      const u = U(id), m = kit.slotModel(u, n.sel);
      if (!m) return;
      if ((n.row ?? 1) === 0) {
        const l = modelsIn(m.cat);
        kit.setModel(id, n.sel, l[(l.findIndex((x) => x.idx === m.idx) + d + l.length) % l.length].idx);
      } else kit.stepParam(id, n.sel, n.page * 5 + (n.row - 1), d);
      kit.syncKnobs(id);
      return;
    }
    if (v === 'settings' || v === 'menu') return M.valueTurn(id, d);
    M.move(id, d);
  }
  function button(id, name, down) {
    const n = kit.nav(id);
    if (name === 'home') return kit.press(id + '|home', down, { tap: () => { if (n.view === 'tuner') kit.tuner(id, false); n.view = 'home'; kit.bump(id); }, hold: () => { M.open(id, 'menu'); kit.bump(id); }, ms: 750 });
    if (name === 'tempo') return kit.press(id + '|tempo', down, { tap: () => kit.tap(id), hold: () => kit.tuner(id), ms: 800 });
    if (!down) return;
    if (['up', 'down', 'left', 'right'].includes(name)) return arrow(id, name);
    if (name === 'enter') return enter(id);
    if (name === 'exit') return exit(id);
    if (name === 'layout') { n.view = 'grid'; return; }
    if (name === 'edit') return openEdit(id);
    if (name === 'store') { const b = B(id); const x = kit.mfx(b); x.presets[U(id)._preset | 0] = JSON.parse(JSON.stringify(Object.assign(dumpNow(b), { name: kit.presetName(b) }))); tz.app.markDirty(); return kit.say(id, 'PRESET STORED'); }
    if (name === 'pgl' || name === 'pgr') { const d = name === 'pgl' ? -1 : 1; if (n.view === 'edit') kit.page(id, d); else if (M.isList(n.view)) M.move(id, d * 7); else if (n.view === 'home' || n.view === 'grid') kit.loadPreset(id, ((U(id)._preset | 0) + d + 64) % 64); }
  }
  function dumpNow(b) {
    const o = {};
    for (const k in b.params) if (/^_(s\d+)/.test(k)) o[k] = b.params[k];
    const x = kit.mfx(b);
    x.snaps[x.snap] = kit.capture(b);
    return { params: o, snaps: x.snaps, snap: x.snap };
  }
  function footswitch(id, k, down) {
    const n = kit.nav(id);
    n.fsMode = n.fsMode || 0;
    const key = id + '|fs' + k;
    const hold = k === 2 ? () => { n.fsMode = (n.fsMode + 1) % 4; kit.say(id, 'LAYOUT: ' + LAYOUTS[n.fsMode]); } : k === 1 ? () => kit.tuner(id) : () => (n.fsMode === 3 ? kit.looper(id, 'clear') : kit.tap(id));
    kit.press(key, down, {
      ms: 800, hold,
      tap: () => {
        if (n.view === 'tuner') return kit.tuner(id, false);
        const u = U(id);
        if (n.fsMode === 0) kit.recallSnap(id, k);
        else if (n.fsMode === 1) { const s = effects(u)[k]; if (s) kit.toggleSlot(id, s); }
        else if (n.fsMode === 2) { if (k < 2) kit.loadPreset(id, ((u._preset | 0) + (k ? 1 : 63)) % 64); else kit.recallSnap(id, ((u._snap | 0) + 1) % 8); }
        else {
          const ls = kit.loopState(tz.app.state.status.blocks[id]);
          if (k === 0) kit.looper(id, 'rec');
          else if (k === 1) kit.looper(id, ls === 1 || ls === 2 || ls === 3 ? 'stop' : 'play');
          else kit.looper(id, 'undo');
        }
        kit.bump(id);
      },
    });
  }
  function fsInfo(id, u, n, k, st) {
    const mode = n.fsMode || 0;
    if (mode === 0) return { t: 'SCENE ' + (k + 1), s: 'SCENES', c: SCENECOL[k], lit: (u._snap | 0) === k };
    if (mode === 1) { const s = effects(u)[k]; const m = s && kit.slotModel(u, s); return m ? { t: m.n.slice(0, 13), s: abbr(m), c: COL[m.cat], lit: kit.slotOn(u, s) } : { t: '—', s: 'EFFECTS', c: '#33415a', lit: false }; }
    if (mode === 2) return [{ t: 'PRESET ▼', s: 'PRESETS', c: CY, lit: false }, { t: 'PRESET ▲', s: 'PRESETS', c: CY, lit: false }, { t: 'SCENE ' + ((u._snap | 0) + 1) + ' ▶', s: 'PRESETS', c: SCENECOL[u._snap | 0], lit: true }][k];
    const ls = kit.loopState(st);
    return [{ t: ls === 3 ? 'OVERDUB' : 'REC / DUB', s: 'LOOPER', c: '#ff5a5a', lit: ls === 1 || ls === 3 }, { t: ls === 2 || ls === 3 ? 'STOP' : 'PLAY', s: 'LOOPER', c: '#46d6a0', lit: ls === 2 }, { t: 'UNDO', s: 'LOOPER', c: '#ffd23a', lit: false }][k];
  }

  // ---------------------------------------------------------------- screens
  const T = (g, x, y, s, o = {}) => kit.svgT(g, x, y, s, Object.assign({ font: FONT, weight: 600, fill: TXT }, o));
  const show = (el, on) => setA(el, 'display', on ? 'inline' : 'none');
  const GX = (c) => 18 + c * 32, GY = (r) => 24 + r * 20.5;
  tz.addScreen('fm-main', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      const defs = svg('defs', {}, g);
      const gid = 'fmg' + Math.random().toString(36).slice(2, 7);
      const lg = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      svg('stop', { offset: 0, 'stop-color': '#0a1a36' }, lg);
      svg('stop', { offset: 1, 'stop-color': '#02050c' }, lg);
      svg('rect', { width: w, height: h, fill: `url(#${gid})` }, g);
      s.hdr = svg('rect', { width: w, height: 11, fill: '#0f2a52' }, g);
      s.hT = T(g, 4, 5.8, '', { size: 6.4, weight: 700, ls: 0.4 });
      s.hR = T(g, w - 4, 5.8, '', { size: 5.6, anchor: 'end', fill: CY });
      // home
      const H = (s.home = svg('g', {}, g));
      s.num = T(H, 6, 30, '', { size: 26, weight: 700, fill: CY });
      s.name = T(H, 62, 25, '', { size: 10, weight: 700 });
      s.scene = T(H, 62, 37, '', { size: 6.4, fill: '#ffd23a', weight: 700 });
      s.mini = [];
      for (let i = 1; i <= N; i++) { const [r, c] = rc(i); s.mini.push(svg('rect', { x: 8 + c * 30.5, y: 50 + r * 9, width: 26, height: 6.4, rx: 1.2, fill: '#0e1f3d' }, H)); }
      s.scn = [];
      for (let k = 0; k < 8; k++) { const x = 6 + k * 23.5; s.scn.push({ r: svg('rect', { x, y: 90, width: 21, height: 10, rx: 2, fill: '#0e1f3d', stroke: '#1d3a63', 'stroke-width': 0.6 }, H), t: T(H, x + 10.5, 95.3, String(k + 1), { size: 5.6, anchor: 'middle', fill: DIM }) }); }
      // grid
      const G = (s.grid = svg('g', {}, g));
      for (let r = 0; r < ROWS; r++) svg('line', { x1: 4, x2: w - 4, y1: GY(r), y2: GY(r), stroke: '#14305a', 'stroke-width': 0.6 }, G);
      for (let c = 0; c <= COLS; c++) svg('line', { x1: GX(c) - 16, x2: GX(c) - 16, y1: 13, y2: h - 4, stroke: '#0c2244', 'stroke-width': 0.5, 'stroke-dasharray': '1 2' }, G);
      s.wires = svg('path', { d: '', stroke: CY, 'stroke-width': 0.8, fill: 'none', 'stroke-opacity': 0.8 }, G);
      s.cells = [];
      for (let i = 1; i <= N; i++) {
        const [r, c] = rc(i);
        const x = GX(c), y = GY(r);
        const box = svg('rect', { x: x - 13, y: y - 7.5, width: 26, height: 15, rx: 2, fill: '#11284a', stroke: '#2a4a78', 'stroke-width': 0.6 }, G);
        const strip = svg('rect', { x: x - 13, y: y - 7.5, width: 2.6, height: 15, rx: 1, fill: '#555' }, G);
        const t = T(G, x + 1, y + 0.3, '', { size: 5.6, weight: 700, anchor: 'middle' });
        const cur = svg('rect', { x: x - 15, y: y - 9.5, width: 30, height: 19, rx: 3, fill: 'none', stroke: '#ffd23a', 'stroke-width': 1.1, 'stroke-opacity': 0 }, G);
        s.cells.push({ box, strip, t, cur });
      }
      // edit
      const E = (s.edit = svg('g', {}, g));
      s.typeBg = svg('rect', { x: 3, y: 14, width: w - 6, height: 12, rx: 2, fill: '#0f2a52', stroke: CY, 'stroke-width': 0.6, 'stroke-opacity': 0 }, E);
      s.typeT = T(E, 7, 20.2, '', { size: 6.4, weight: 700 });
      s.prow = [];
      for (let k = 0; k < 5; k++) {
        const y = 30 + k * 14.4;
        const bg = svg('rect', { x: 3, y, width: w - 6, height: 12.6, rx: 2, fill: '#0b1d3a', stroke: CY, 'stroke-width': 0.6, 'stroke-opacity': 0 }, E);
        T(E, 9, y + 6.4, 'ABCDE'[k], { size: 6, weight: 700, anchor: 'middle', fill: CY });
        const nm = T(E, 16, y + 6.4, '', { size: 6 });
        svg('rect', { x: 78, y: y + 4.6, width: 70, height: 3.4, rx: 1.7, fill: '#14305a' }, E);
        const bar = svg('rect', { x: 78, y: y + 4.6, width: 0, height: 3.4, rx: 1.7, fill: CY }, E);
        const vl = T(E, w - 7, y + 6.4, '', { size: 6, anchor: 'end', weight: 700 });
        s.prow.push({ bg, nm, bar, vl });
      }
      // list
      const L = (s.list = svg('g', {}, g));
      s.rows = [];
      for (let r = 0; r < 8; r++) {
        const y = 13.5 + r * 11;
        const hl = svg('rect', { x: 3, y, width: w - 6, height: 10.2, rx: 1.5, fill: CY, 'fill-opacity': 0 }, L);
        const sw = svg('rect', { x: 6, y: y + 3.1, width: 4, height: 4, fill: '#555' }, L);
        const t = T(L, 14, y + 5.3, '', { size: 6.2 });
        const rr = T(L, w - 7, y + 5.3, '', { size: 5.6, anchor: 'end', fill: DIM });
        s.rows.push({ hl, sw, t, rr });
      }
      // tuner
      const TU = (s.tun = svg('g', {}, g));
      for (let k = -5; k <= 5; k++) { const a = (k / 5) * 1.05; svg('line', { x1: w / 2 + Math.sin(a) * 38, y1: 78 - Math.cos(a) * 38, x2: w / 2 + Math.sin(a) * (k % 5 ? 42 : 45), y2: 78 - Math.cos(a) * (k % 5 ? 42 : 45), stroke: k ? DIM : '#46d6a0', 'stroke-width': 0.9 }, TU); }
      s.needleG = svg('g', { transform: `translate(${w / 2},78)` }, TU);
      s.needle = svg('line', { x1: 0, y1: 0, x2: 0, y2: -40, stroke: '#ff5a5a', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, s.needleG);
      s.tn = T(TU, w / 2, 23, '', { size: 14, weight: 700, anchor: 'middle' });
      s.tc = T(TU, w / 2, 92, '', { size: 6, anchor: 'middle', fill: DIM });
      s.toast = svg('g', { display: 'none' }, g);
      svg('rect', { x: w / 2 - 50, y: h / 2 - 8, width: 100, height: 16, rx: 2, fill: '#02050c', stroke: CY, 'stroke-width': 0.8 }, s.toast);
      s.toastT = T(s.toast, w / 2, h / 2, '', { size: 7, anchor: 'middle', weight: 700, fill: CY });
      s.sig = '';
    },
    update(s, st, nv, now) {
      const b = nv.block, id = b.id, u = s.ui, n = kit.nav(id), w = s.w;
      if (n.view === 'home' && n._init === undefined) { n._init = 1; }
      const lv = kit.live.get(id);
      if (lv) for (let k = 0; k < 3; k++) { const fi = fsInfo(id, u, n, k, st); setA(lv.rings[k], 'stroke', fi.c); setA(lv.rings[k], 'stroke-opacity', fi.lit ? 1 : 0.18); }
      const ton = n.msg && now - n.msgT < 1300;
      show(s.toast, ton);
      if (ton) setText(s.toastT, n.msg);
      const v = n.view;
      show(s.home, v === 'home'); show(s.grid, v === 'grid'); show(s.edit, v === 'edit'); show(s.list, M.isList(v)); show(s.tun, v === 'tuner');
      if (v === 'tuner') {
        setText(s.hT, 'TUNER'); setText(s.hR, (u._tref ?? 440) + ' Hz');
        const t = st && st.tu && st.tu.tuner;
        const c = t && t.note ? t.cents : 0;
        setA(s.needleG, 'transform', `translate(${w / 2},78) rotate(${(Math.max(-50, Math.min(50, c)) / 50) * 60})`);
        setA(s.needle, 'stroke', t && t.note && Math.abs(c) < 2 ? '#46d6a0' : '#ff5a5a');
        setText(s.tn, t && t.note ? t.note : '–');
        setText(s.tc, t && t.note ? `${c >= 0 ? '+' : ''}${c.toFixed(1)} cents` : 'play a string');
        return;
      }
      const sig = n.rev + v + n.sel + '|' + n.page + '|' + n.cur + '|' + n.row + '|' + (n.fsMode || 0) + JSON.stringify(b.params) + (b.mfx ? b.mfx.name : '');
      if (sig === s.sig) return;
      s.sig = sig;
      const pn = u._preset | 0;
      if (v === 'home') {
        setText(s.hT, 'HOME'); setText(s.hR, `${LAYOUTS[n.fsMode || 0]} · ${Math.round(u._bpm ?? 120)} BPM`);
        setText(s.num, pNum(pn));
        setText(s.name, kit.presetName(b).slice(0, 18));
        setText(s.scene, `SCENE ${(u._snap | 0) + 1}`);
        s.mini.forEach((r, k) => { const m = kit.slotModel(u, k + 1); setA(r, 'fill', m ? (kit.slotOn(u, k + 1) ? COL[m.cat] : '#33415a') : '#0e1f3d'); });
        s.scn.forEach((e, k) => { const on = (u._snap | 0) === k; setA(e.r, 'fill', on ? SCENECOL[k] : '#0e1f3d'); setA(e.t, 'fill', on ? '#02050c' : DIM); });
      } else if (v === 'grid') {
        setText(s.hT, 'LAYOUT'); setText(s.hR, `${pNum(pn)} ${kit.presetName(b).slice(0, 14)}`);
        const counts = {};
        let d = '';
        const occ = (r, c) => !!kit.slotModel(u, idx(r, c));
        for (let c = 0; c < COLS; c++) {
          const rs = [0, 1, 2, 3].filter((r) => occ(r, c));
          if (rs.length > 1) d += `M${GX(c) - 16} ${GY(rs[0])} V${GY(rs[rs.length - 1])} M${GX(c) + 16} ${GY(rs[0])} V${GY(rs[rs.length - 1])}`;
        }
        for (let r = 0; r < ROWS; r++) {
          const cs = [0, 1, 2, 3, 4, 5].filter((c) => occ(r, c));
          if (cs.length) d += `M${GX(cs[0]) - 16} ${GY(r)} H${GX(cs[cs.length - 1]) + 16}`;
        }
        setA(s.wires, 'd', d);
        s.cells.forEach((e, k) => {
          const i = k + 1, m = kit.slotModel(u, i), on = kit.slotOn(u, i);
          show(e.box, !!m); show(e.strip, !!m); show(e.t, !!m);
          if (m) {
            const a = abbr(m);
            counts[a] = (counts[a] || 0) + 1;
            setText(e.t, a + ' ' + counts[a]);
            setA(e.strip, 'fill', COL[m.cat]);
            setA(e.box, 'fill', on ? '#1d3a63' : '#0b1527');
            setA(e.t, 'fill', on ? TXT : '#4d5f7d');
          }
          setA(e.cur, 'stroke-opacity', i === n.sel ? 1 : 0);
        });
      } else if (v === 'edit') {
        const m = kit.slotModel(u, n.sel);
        const np = kit.pages(u, n.sel, 5);
        setText(s.hT, m ? `${abbr(m)} · ${CATS[m.cat].n.toUpperCase()}${kit.slotOn(u, n.sel) ? '' : ' (BYPASSED)'}` : 'EDIT');
        setText(s.hR, `PAGE ${n.page + 1}/${np}`);
        setText(s.typeT, m ? `TYPE   ◂ ${m.n} ▸` : '');
        setA(s.typeBg, 'stroke-opacity', (n.row ?? 1) === 0 ? 1 : 0);
        s.prow.forEach((e, k) => {
          const j = n.page * 5 + k, p = m && m.P[j];
          show(e.bg, true);
          setText(e.nm, p ? p.n : '');
          const pos = p ? kit.slotPos(u, n.sel, j, m) : 0;
          setA(e.bar, 'width', p ? (70 * pos).toFixed(1) : 0);
          setText(e.vl, p ? pText(p, pos) : '');
          setA(e.bg, 'stroke-opacity', (n.row ?? 1) === k + 1 ? 1 : 0);
        });
      } else if (M.isList(v)) {
        const it = M.items(id);
        n.cur = Math.min(n.cur, Math.max(0, it.length - 1));
        n.top = kit.windowTop(it.length, n.cur, n.top || 0, 8);
        setText(s.hT, v === 'models' ? 'TYPE: ' + CATS[n.cat].n.toUpperCase() : TITLES[v]);
        const [r, c] = rc(n.sel);
        setText(s.hR, v === 'cats' || v === 'models' ? `ROW ${r + 1} · COL ${c + 1}` : pNum(pn));
        s.rows.forEach((e, k) => {
          const x = it[n.top + k];
          show(e.t, !!x); show(e.rr, !!x); show(e.sw, !!(x && x.c));
          const sel = x && n.top + k === n.cur;
          setA(e.hl, 'fill-opacity', sel ? 0.85 : 0);
          if (!x) return;
          setText(e.t, x.t + (x.mark ? '  ◆' : ''));
          setText(e.rr, x.r || '');
          if (x.c) setA(e.sw, 'fill', x.c);
          setA(e.t, 'fill', sel ? '#02050c' : TXT);
          setA(e.rr, 'fill', sel ? '#02050c' : DIM);
          setA(e.t, 'x', x.c ? 14 : 7);
        });
      }
    },
    pointer(s, nv, type, pt) {
      if (type !== 'down') return;
      const id = nv.block.id, n = kit.nav(id);
      if (n.view === 'grid') {
        const c = Math.round((pt.x - 18) / 32), r = Math.round((pt.y - 24) / 20.5);
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) { const i = idx(r, c); if (n.sel === i) enter(id); else kit.selectSlot(id, i); }
      } else if (n.view === 'home') n.view = 'grid';
      else if (n.view === 'edit') { if (pt.y < 27) { n.row = 0; } else { const k = Math.floor((pt.y - 30) / 14.4); if (k >= 0 && k < 5) n.row = k + 1; } }
      else if (M.isList(n.view)) { const r = Math.floor((pt.y - 13.5) / 11); const it = M.items(id); if (pt.y < 12) exit(id); else if (r >= 0 && r < 8 && n.top + r < it.length) { if (n.cur === n.top + r) enter(id); else n.cur = n.top + r; } }
      else if (n.view === 'tuner') kit.tuner(id, false);
      kit.bump(id);
    },
  });
  // mini displays above the footswitches
  tz.addScreen('fm-mini', {
    build(s, g, w, h) {
      svg('rect', { width: w, height: h, fill: '#000' }, g);
      s.bar = svg('rect', { x: 0, y: 0, width: w, height: 2.4, fill: CY }, g);
      s.t = T(g, w / 2, h / 2 + 2, '', { size: 6.6, anchor: 'middle', weight: 700 });
      s.s = T(g, w - 2.5, 5.5, '', { size: 3.6, anchor: 'end', fill: DIM });
    },
    update(s, st, nv) {
      const n = kit.nav(nv.block.id);
      const fi = fsInfo(nv.block.id, s.ui, n, s.ctl.fs, st);
      setText(s.t, fi.t);
      setText(s.s, '');
      setA(s.bar, 'fill', fi.lit ? fi.c : '#1d3a63');
      setA(s.t, 'fill', fi.lit ? '#ffffff' : fi.c);
    },
  });
  kit.addEncoder('fm-wheel', (s, g, w, h) => {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 2;
    svg('circle', { cx, cy: cy + 2, r: r + 1, fill: '#000', 'fill-opacity': 0.55 }, g);
    svg('circle', { cx, cy, r, fill: 'url(#g-chromeR)', stroke: '#1b1d22', 'stroke-width': 0.8 }, g);
    for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; svg('line', { x1: cx + Math.cos(a) * r, y1: cy + Math.sin(a) * r, x2: cx + Math.cos(a) * (r - 3), y2: cy + Math.sin(a) * (r - 3), stroke: '#000', 'stroke-opacity': 0.45, 'stroke-width': 0.9 }, g); }
    svg('circle', { cx, cy, r: r * 0.7, fill: 'url(#g-chromeDome)' }, g);
    const rot = svg('g', {}, svg('g', { transform: `translate(${cx},${cy})` }, g));
    svg('circle', { cx: 0, cy: -r * 0.5, r: 2, fill: '#1a1c20' }, rot);
    svg('rect', { width: w, height: h, fill: 'transparent' }, g);
    return rot;
  }, wheel, (id) => enter(id));

  // ---------------------------------------------------------------- enclosure
  const W = 432, H = 268;
  const PAD = [['up', 370, 34, '▲'], ['down', 370, 82, '▼'], ['left', 346, 58, '◀'], ['right', 394, 58, '▶'], ['enter', 370, 58, 'ENTER']];
  const BTNS = [['home', 'HOME', 282, 112], ['layout', 'LAYOUT', 320, 112], ['edit', 'EDIT', 358, 112], ['exit', 'EXIT', 396, 112], ['tempo', 'TEMPO', 282, 140], ['store', 'STORE', 320, 140], ['pgl', '◂ PAGE', 358, 140], ['pgr', 'PAGE ▸', 396, 140]];
  const FX = (k) => 92 + k * 124;
  tz.addForm('fm-axis', (ctx, d) => {
    const g = ctx.g;
    // folded steel chassis: black with a brushed top deck
    formKit.body(g, W, H, '#17191d', { rx: 8 });
    svg('rect', { x: 0, y: 0, width: W, height: 160, rx: 8, fill: '#202329' }, g);
    svg('rect', { x: 0, y: 0, width: W, height: 160, rx: 8, fill: 'url(#p-brushed)', 'fill-opacity': 0.5 }, g);
    svg('rect', { x: 0, y: 158, width: W, height: 2.2, fill: '#000', 'fill-opacity': 0.55 }, g);
    const theme = { text: '#cfd6e2', knob: 'chrome', labelSize: 6, labelFont: FONT };
    label(g, 30, 128, 'AXIS', { size: 13, fill: '#e8ecf2', weight: 800, ls: 2.2, font: FONT });
    label(g, 30, 141, 'M3', { size: 9, fill: CY, weight: 800, ls: 1.4, font: FONT });
    formKit.tzBadge(g, W - 30, H - 9, '#6e7682', 4);
    label(g, 292, 22, 'VALUE', { size: 5.2, fill: '#9aa3b2', weight: 700, font: FONT });
    svg('circle', { cx: 370, cy: 58, r: 31, fill: '#121418', stroke: '#2c3038', 'stroke-width': 0.8 }, g);
    for (const [k, x, y, t] of PAD) {
      if (k === 'enter') { svg('circle', { cx: x, cy: y, r: 9, fill: '#2b2f37', stroke: '#454b55', 'stroke-width': 0.6 }, g); label(g, x, y, t, { size: 3.8, fill: '#cfd6e2', weight: 700, font: FONT }); }
      else { svg('circle', { cx: x, cy: y, r: 7, fill: '#24272e', stroke: '#3c414a', 'stroke-width': 0.6 }, g); label(g, x, y, t, { size: 5.4, fill: '#cfd6e2', weight: 700, font: FONT }); }
    }
    for (const [, t, x, y] of BTNS) {
      svg('rect', { x: x - 15, y: y - 6, width: 30, height: 12, rx: 2, fill: '#000', 'fill-opacity': 0.6 }, g);
      svg('rect', { x: x - 14.5, y: y - 5.6, width: 29, height: 11, rx: 1.8, fill: '#2b2f37', stroke: '#454b55', 'stroke-width': 0.5 }, g);
      label(g, x, y, t, { size: 4.8, fill: '#dfe5ee', weight: 700, font: FONT });
    }
    const rings = [];
    for (let k = 0; k < 3; k++) {
      svg('circle', { cx: FX(k), cy: 228, r: 21, fill: '#0d0e10', stroke: '#30343b', 'stroke-width': 0.8 }, g);
      rings.push(svg('circle', { cx: FX(k), cy: 228, r: 18.5, fill: 'none', stroke: CY, 'stroke-width': 2.2, 'stroke-opacity': 0.2 }, g));
      label(g, FX(k) + 30, 248, `FS${k + 1}`, { size: 4.6, fill: '#6e7682', weight: 700, font: FONT });
    }
    if (ctx.block) kit.live.set(ctx.block.id, { rings });
    formKit.placeControls(ctx, d.controls, theme);
    const X = (x) => (ctx.flip ? W - x : x);
    const jacks = [];
    d.ctrl.ins.forEach((c, i) => jacks.push({ key: 'ic' + i, dir: 'in', port: 'c' + i, label: c.label, side: 'top', x: X(266 + i * 28), y: -2, kind: 'ctrl' }));
    d.ports.outs.forEach((l, i) => jacks.push({ key: 'o' + i, dir: 'out', port: i, label: l.replace('OUTPUT', 'OUT'), side: 'top', x: X(W - 40 - i * 28), y: -2 }));
    d.ports.ins.forEach((l, i) => jacks.push({ key: 'i' + i, dir: 'in', port: i, label: l.replace('INPUT', 'IN'), side: 'top', x: X(W - 40 - (d.ports.outs.length + 0.6 + i) * 28), y: -2 }));
    return { w: W, h: H, theme, jacks };
  });
  const controls = [
    SCREEN('fm-main', { x: 150, y: 64, w: 196, h: 104, interactive: true, bg: '#02050c', bezel: '#050608' }),
    K('_vol', 'OUT 1', { x: 30, y: 46, r: 11, min: -30, max: 6, def: 0, virtual: true, display: db, labelPos: 'below' }),
    ...'ABCDE'.split('').map((l, k) => K('k' + (k + 1), l, { x: 74 + k * 38, y: 138, r: 9.5, def: 0.5, virtual: true, labelPos: 'below', labelSize: 6.4 })),
    SCREEN('fm-wheel', { x: 292, y: 60, w: 44, h: 44, interactive: true, bg: 'transparent', bezel: 'transparent' }),
    ...PAD.map(([btn, x, y]) => FOOT({ action: 'mfx', mfx: 'btn', btn, style: 'plate', w: btn === 'enter' ? 18 : 15, h: btn === 'enter' ? 18 : 15, x, y })),
    ...BTNS.map(([btn, , x, y]) => FOOT({ action: 'mfx', mfx: 'btn', btn, style: 'plate', w: 30, h: 12, x, y })),
    ...[0, 1, 2].map((k) => SCREEN('fm-mini', { fs: k, x: FX(k), y: 184, w: 72, h: 20, bg: '#000', bezel: '#08090b' })),
    ...[0, 1, 2].map((k) => FOOT({ action: 'mfx', mfx: 'fs', fs: k, style: 'stomp', r: 13, x: FX(k), y: 228 })),
  ];
  const d = def({
    id: ID, name: 'Axis M3', ref: 'Fractal Audio FM3', brand: 'Fractal Audio', code: 'AXIS M3', typeName: 'Amp modeler / effects processor', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'fm-axis', color: '#17191d', stereo: 'both', cost: 7, alwaysOn: true,
    monoPorts: { ins: ['INPUT 1'], outs: ['OUTPUT 1 L'] }, stereoPorts: { ins: ['INPUT 1'], outs: ['OUTPUT 1 L', 'OUTPUT 1 R'] }, ports: { ins: ['INPUT 1'], outs: ['OUTPUT 1 L'] },
    ctrl: { ins: [{ label: 'PEDAL 1', hook: true, exp: 1 }, { label: 'PEDAL 2', hook: true, exp: 2 }] },
    controls,
    tags: ['fractal', 'grid', 'scenes', 'modeler'],
    desc: 'A 4 × 6 routing grid: blocks run column by column, and blocks stacked in the same columns on different rows run as parallel rows (dual amps, parallel delay + reverb …). LAYOUT shows the grid — move the cursor with the arrows or VALUE wheel, ENTER on an empty cell adds a block (type → model), ENTER on a block opens EDIT. EDIT: TYPE row (VALUE scrolls models, ENTER lists them) and five parameters per page on knobs A–E, ◂ / ▸ or PAGE flip pages. HOME shows the preset and scenes (VALUE = scene), hold HOME for SETUP (global config, tuner, tempo, footswitch layout). TEMPO taps (hold = tuner), STORE saves the preset. Footswitches follow the layout on their mini displays: SCENES 1–3, EFFECTS, PRESETS, LOOPER; hold FS3 = next layout, hold FS2 = tuner, hold FS1 = tap.',
  });
  kit.register(d, {
    n: N, knobs: 5, sel0: idx(1, 1), layout, inputGate: true, looper: true, presets, snapWord: 'Scene',
    knobTarget: (u, n, k) => [n.sel, n.page * 5 + k - 1],
    foot(id, ctl, down) { if (ctl.mfx === 'btn') button(id, ctl.btn, down); else footswitch(id, ctl.fs, down); },
  });
  tz.addDefs([d]);
}
